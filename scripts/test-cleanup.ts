import { db } from "../lib/db";
import { readings } from "../lib/db/schema";
import { cleanupOldReadings } from "../lib/db/maintenance";
import { sql } from "drizzle-orm";

async function testCleanup() {
    console.log("--- Starting Cleanup Test ---");

    const now = Math.floor(Date.now() / 1000);
    const eightDaysAgo = now - (8 * 24 * 60 * 60);
    const sixDaysAgo = now - (6 * 24 * 60 * 60);

    try {
        // 1. Insert test data
        console.log("Inserting test data...");
        await db.insert(readings).values([
            { tankId: "test-1", level: 50, timestamp: eightDaysAgo }, // Should be deleted
            { tankId: "test-2", level: 60, timestamp: sixDaysAgo },   // Should stay
            { tankId: "test-3", level: 70, timestamp: now }          // Should stay
        ]);

        // 2. Count before
        const beforeCount = (await db.select({ count: sql`count(*)` }).from(readings))[0].count as number;
        console.log(`Readings before cleanup: ${beforeCount}`);

        // 3. Run cleanup
        const deleted = await cleanupOldReadings(7);
        console.log(`Cleanup function reported deleting ${deleted} records.`);

        // 4. Verify results
        const afterReadings = await db.select().from(readings).where(sql`tank_id LIKE 'test-%'`);
        console.log(`Remaining test readings: ${afterReadings.length}`);

        const hasOld = afterReadings.some((r: typeof readings.$inferSelect) => r.timestamp === eightDaysAgo);
        const hasNew = afterReadings.some((r: typeof readings.$inferSelect) => r.timestamp === sixDaysAgo || r.timestamp === now);

        if (!hasOld && hasNew) {
            console.log("✅ SUCCESS: Old records removed, recent records kept.");
        } else {
            console.error("❌ FAILURE: Cleanup logic didn't work as expected.");
            console.error("Remaining records:", afterReadings);
        }

        // 5. Cleanup test data
        await db.delete(readings).where(sql`tank_id LIKE 'test-%'`);
        console.log("Test data cleared.");

    } catch (error) {
        console.error("Test failed with error:", error);
    }
}

testCleanup();
