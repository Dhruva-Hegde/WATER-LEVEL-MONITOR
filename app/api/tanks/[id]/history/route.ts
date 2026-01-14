import { db } from "@/lib/db";
import { readings } from "@/lib/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const rangeMinutes = parseInt(searchParams.get("range") || "1440"); // Default 24h

    // Calculate start time in Unix Seconds
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (rangeMinutes * 60);

    try {
        const history = await db.select()
            .from(readings)
            .where(
                and(
                    eq(readings.tankId, id),
                    gt(readings.timestamp, startTime)
                )
            )
            .orderBy(desc(readings.timestamp))
            .limit(100);

        return NextResponse.json(history);
    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
