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

    // Calculate start time
    const now = new Date();
    const startTime = new Date(now.getTime() - rangeMinutes * 60 * 1000);
    const startTimeIso = startTime.toISOString();

    try {
        const history = await db.select()
            .from(readings)
            .where(
                and(
                    eq(readings.tankId, id),
                    gt(readings.timestamp, startTimeIso)
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
