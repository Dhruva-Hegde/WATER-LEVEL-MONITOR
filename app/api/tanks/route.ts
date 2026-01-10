import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tanks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { removeTank, getSecretById } from "@/lib/store";

// GET: Fetch all tank configurations
export async function GET() {
    try {
        const allTanks = await db.select().from(tanks);
        return NextResponse.json(allTanks);
    } catch (error) {
        console.error("Failed to fetch tanks:", error);
        return NextResponse.json({ error: "Failed to fetch tanks" }, { status: 500 });
    }
}

// POST: Legacy endpoint disabled. Use WebSocket 'client-update-config' for updates.
export async function POST() {
    return NextResponse.json({ error: "Method Not Allowed. Use WebSocket for configuration updates." }, { status: 405 });
}

// DELETE: Decommission a tank permanently
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        console.log(`[API] Decommissioning node: ${id}`);

        // 1. Authoritative Database Purge
        const dbResult = await db.delete(tanks).where(eq(tanks.id, id)).returning({ secret: tanks.secret });
        const dbSecret = dbResult[0]?.secret;

        // 2. Authoritative Memory & Socket Purge
        // We look for secrets in both the DB result and the current memory store
        const memorySecret = await getSecretById(id);
        const secret = dbSecret || memorySecret;

        const removedFromMemory = removeTank(id);

        // 3. Global Broadcast of Deletion
        const io = (global as any).io;
        if (io) {
            io.to("dashboard").emit("tank-decommissioned", { id });

            if (secret) {
                const roomName = `device-${secret}`;
                io.in(roomName).disconnectSockets(true);
                console.log(`[API] Purged socket room: ${secret.slice(0, 8)}...`);
            }
        }

        console.log(`[API] Node ${id} fully decommissioned (DB: ${!!dbSecret}, Memory: ${removedFromMemory})`);

        return NextResponse.json({
            success: true,
            id,
            dbPurged: !!dbSecret,
            memoryPurged: removedFromMemory
        });
    } catch (error) {
        console.error("[API] Deletion failed:", error);
        return NextResponse.json({ error: "Failed to delete tank" }, { status: 500 });
    }
}
