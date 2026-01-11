
import { db } from "@/lib/db";
import { tanks } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

async function main() {
    console.log("Seeding database with 6 mock tanks...");

    const newTanks = [
        {
            name: "North Wing - Main",
            location: "North Wing",
            capacity: 5000,
            height: 200,
        },
        {
            name: "South Wing - Reserve",
            location: "South Wing",
            capacity: 3000,
            height: 150,
        },
        {
            name: "East Block - Fire",
            location: "East Block",
            capacity: 10000,
            height: 300,
        },
        {
            name: "West Block - Domestic",
            location: "West Block",
            capacity: 2000,
            height: 120,
        },
        {
            name: "Central Garden - Irrigation",
            location: "Garden Area",
            capacity: 1500,
            height: 100,
        },
        {
            name: "Cafeteria - Potable",
            location: "Main Building",
            capacity: 1000,
            height: 80,
        }
    ];

    for (const tank of newTanks) {
        const id = uuidv4();
        const secret = uuidv4();

        await db.insert(tanks).values({
            id,
            name: tank.name,
            location: tank.location,
            capacity: tank.capacity,
            height: tank.height,
            secret,
            deviceId: `mock-device-${id.slice(0, 8)}`,
        });

        console.log(`Inserted tank: ${tank.name} (ID: ${id})`);
    }

    console.log("Seeding complete!");
}

main().catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
