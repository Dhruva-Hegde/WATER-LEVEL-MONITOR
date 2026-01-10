import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const tanks = sqliteTable("tanks", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    capacity: integer("capacity").notNull().default(5000),
    height: integer("height").notNull().default(100),

    // Auth & Device Info
    secret: text("secret").unique(),
    deviceId: text("device_id").unique(),
    ipAddress: text("ip_address"),
});

export type Tank = typeof tanks.$inferSelect;
export type NewTank = typeof tanks.$inferInsert;
