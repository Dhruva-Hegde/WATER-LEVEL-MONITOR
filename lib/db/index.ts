import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";

const sqlitePath = path.join(process.cwd(), "sqlite.db");
console.log(`[DB] Database linked: ${sqlitePath}`);

// Use singleton pattern for Next.js HMR
const globalForDb = global as unknown as { db: any };

export const db = globalForDb.db || drizzle(new Database(sqlitePath), { schema });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
