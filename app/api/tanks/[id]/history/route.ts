import { db } from "@/lib/db";
import { readings } from "@/lib/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (process.env.NEXT_PUBLIC_ENABLE_HISTORY !== "true") {
        return NextResponse.json({ error: "History feature disabled" }, { status: 404 });
    }

    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const rangeMinutes = parseInt(searchParams.get("range") || "10080"); // Default 7d

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
            .limit(1200);

        return NextResponse.json(history);
    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
