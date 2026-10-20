import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";
import * as fs from "fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/autopsy";

/**
 * Pool config tuned for serverless (Vercel Functions) + managed DB poolers (Supabase, Neon):
 * - max 5 concurrent connections per function instance (the DB pooler does the real work)
 * - idle connections closed after 10s (functions are short-lived)
 * - connection attempt times out after 5s so cold starts fail fast
 *
 * In development, the pool is cached on globalThis to survive Next.js hot-reload.
 * In production on Vercel each function instance is isolated, so globalThis caching
 * has no effect and each instance creates its own pool (this is correct behaviour).
 */
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
