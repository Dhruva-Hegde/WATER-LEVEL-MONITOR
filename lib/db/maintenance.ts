import { db } from "./index";
import { readings } from "./schema";
import { lt } from "drizzle-orm";

/**
 * Deletes readings older than the specified number of days.
 * @param days Retention period in days
 */
export async function cleanupOldReadings(days: number = 7) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const retentionSeconds = days * 24 * 60 * 60;
    const cutoff = nowSeconds - retentionSeconds;

    console.log(`[Maintenance] Starting database cleanup. Removing readings older than ${days} days (Cutoff: ${new Date(cutoff * 1000).toISOString()})`);

    try {
        const result = await db.delete(readings).where(lt(readings.timestamp, cutoff));
        // Note: Drizzle with better-sqlite3 returns an object with 'changes' property for deletes
        const deletedCount = (result as any).changes || 0;

        if (deletedCount > 0) {
            console.log(`[Maintenance] Success: Cleaned up ${deletedCount} old readings.`);
        } else {
            console.log(`[Maintenance] No old readings found to clean up.`);
        }

        return deletedCount;
    } catch (error) {
        console.error(`[Maintenance] Error during database cleanup:`, error);
        throw error;
    }
}
