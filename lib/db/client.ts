import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { Database } from "./schema";

let db: Kysely<Database> | null = null;

/** Lazy Postgres pool — only created when DATABASE_URL is set. */
export function getDb(): Kysely<Database> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!db) {
    const pool = new Pool({
      connectionString: url,
      ssl: url.includes("sslmode=require") || process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
    });
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  }
  return db;
}

/** Ping Postgres — used by /api/health. */
export async function dbPing(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await sql`select 1`.execute(getDb());
    return true;
  } catch {
    return false;
  }
}

export { sql };
