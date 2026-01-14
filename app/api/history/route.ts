import { db } from "@/lib/db";
import { readings, tanks } from "@/lib/db/schema";
import { eq, and, gt, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    if (process.env.NEXT_PUBLIC_ENABLE_HISTORY !== "true") {
        return NextResponse.json({ error: "History feature disabled" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const rangeMinutes = parseInt(searchParams.get("range") || "10080"); // Default 7d

    // Calculate start time in Unix Seconds
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (rangeMinutes * 60);

    try {
        // 1. Get all active tank IDs
        const activeTanks = await db.select({ id: tanks.id, name: tanks.name }).from(tanks);
        const tankIds = activeTanks.map((t: any) => t.id);

        if (tankIds.length === 0) {
            return NextResponse.json([]);
        }

        // 2. Fetch history for those tanks
        const allHistory = await db.select()
            .from(readings)
            .where(
                and(
                    inArray(readings.tankId, tankIds),
                    gt(readings.timestamp, startTime)
                )
            )
            .orderBy(desc(readings.timestamp))
            .limit(10000); // Support ~8 tanks * 1100 points

        return NextResponse.json({
            history: allHistory,
            tanks: activeTanks
        });
    } catch (error) {
        console.error("Global History API Error:", error);
        return NextResponse.json({ error: "Failed to fetch fleet history" }, { status: 500 });
    }
}
