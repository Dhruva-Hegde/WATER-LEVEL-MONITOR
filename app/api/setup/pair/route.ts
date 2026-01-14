export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { tanks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLocalIP } from "@/lib/discovery";
import { registerTank } from "@/lib/store";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(req: Request) {
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "127.0.0.1";
    if (isRateLimited(ip, 20, 60000)) {
        console.warn(`[RateLimit] Pairing throttled for IP: ${ip}`);
        return NextResponse.json({ error: "Pairing attempts throttled. Try again later." }, { status: 429 });
    }
    try {
        const { targetIp, port, tankName, deviceId, height } = await req.json();
        const serverIp = getLocalIP();
        const targetPort = port || 80;

        if (!targetIp || !tankName) {
            return NextResponse.json({ error: "Missing targetIp or tankName" }, { status: 400 });
        }

        // 0. Strict ID/Secret De-duplication
        if (deviceId) {
            const existing = await db.select().from(tanks).where(eq(tanks.deviceId, deviceId)).limit(1);
            if (existing.length > 0) {
                console.warn(`[API] Pairing Refused: Device ${deviceId} already registered.`);
                return NextResponse.json({ error: "Physical device already paired" }, { status: 409 });
            }
        }

        // 1. Generate Authoritative Credentials
        const tankId = "tank_" + uuidv4().slice(0, 8);
        const secret = uuidv4();

        console.log(`Pairing: Connecting to device at ${targetIp}...`);

        // 2. Send credentials to the device
        try {
            const response = await fetch(`http://${targetIp}:${targetPort}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret,
                    tankId,
                    serverUrl: `http://${serverIp}:3000`,
                }),
            });

            if (!response.ok) {
                throw new Error(`Device refused pairing: ${response.statusText}`);
            }
        } catch (err: any) {
            console.error("Failed to connect to device:", err);
            return NextResponse.json({ error: "Could not connect to device at " + targetIp }, { status: 502 });
        }

        // 3. Insert into Database
        try {
            await db.insert(tanks).values({
                id: tankId,
                name: tankName,
                location: "Central Fleet",
                capacity: 5000,
                height: Number(height || 100),
                secret: secret,
                deviceId: deviceId,
                ipAddress: targetIp
            });
        } catch (dbErr: any) {
            console.error("[API] DB Insert failed (Duplicate?):", dbErr);
            if (dbErr.code === 'SQLITE_CONSTRAINT' || dbErr.message?.includes('UNIQUE')) {
                return NextResponse.json({ error: "Node already registered in fleet" }, { status: 409 });
            }
            throw dbErr;
        }

        // 4. Register in memory and broadcast
        const registeredState = await registerTank(secret, {
            id: tankId,
            name: tankName,
            capacity: 5000,
            height: Number(height || 100),
            location: "Central Fleet"
        });

        const io = (global as any).io;
        if (io) {
            io.to("dashboard").emit("tank-live-update", registeredState);
        }

        console.log(`[API] Pairing Successful: ${tankName} (${tankId})`);
        return NextResponse.json({ success: true, id: tankId });

    } catch (error: any) {
        console.error("Pairing error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
