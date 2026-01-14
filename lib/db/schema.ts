import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const tanks = sqliteTable("tanks", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    capacity: integer("capacity").notNull().default(5000),
    height: integer("height").notNull().default(100),
    alertThreshold: integer("alert_threshold").notNull().default(10),

    // Auth & Device Info
    secret: text("secret").unique(),
    deviceId: text("device_id").unique(),
    ipAddress: text("ip_address"),

    // Live State (Persistent Shadow)
    lastLevel: integer("last_level").notNull().default(0),
    lastStatus: text("last_status").notNull().default("offline"),
    lastRssi: integer("last_rssi"),
    lastSeen: integer("last_seen"),
});

export const readings = sqliteTable("readings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tankId: text("tank_id").notNull(),
    level: integer("level").notNull(),
    timestamp: integer("timestamp").notNull().default(sql`(strftime('%s', 'now'))`),
});

export type Tank = typeof tanks.$inferSelect;
export type NewTank = typeof tanks.$inferInsert;
