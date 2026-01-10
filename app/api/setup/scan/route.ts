export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { scanDevices, startMDNS } from "@/lib/discovery";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tanks } from "@/lib/db/schema";

// Ensure mDNS is started when this module is loaded/used
let mdnsStarted = false;

export async function GET() {
    if (!mdnsStarted) {
        try {
            startMDNS();
            mdnsStarted = true;
        } catch (e) {
            console.warn("mDNS already started or failed to start:", e);
        }
    }

    try {
        const devices = await scanDevices();

        // Check which devices are already paired (Match by deviceId OR IP)
        const existingTanks = await db.select({ deviceId: tanks.deviceId, ip: tanks.ipAddress }).from(tanks);
        const pairedIds = new Set(existingTanks.map((t: { deviceId: string | null }) => t.deviceId).filter(Boolean));
        const pairedIps = new Set(existingTanks.map((t: { ip: string | null }) => t.ip).filter(Boolean));

        const devicesWithStatus = devices.map(d => ({
            ...d,
            isPaired: (d.id && pairedIds.has(d.id)) || pairedIps.has(d.ip)
        }));

        return NextResponse.json({ devices: devicesWithStatus });
    } catch (error) {
        console.error("Scan failed:", error);
        return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }
}
