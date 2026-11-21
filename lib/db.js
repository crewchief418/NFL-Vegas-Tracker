import { Pool } from "pg";

const globalForPg = globalThis;
const connectionString = process.env.DATABASE_URL
  ? (() => {
      const url = new URL(process.env.DATABASE_URL);
      // Keep pg-connection-string's future SSL behavior explicit and strict.
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    })()
  : undefined;

const pool = globalForPg.pgPool ?? new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query(text, params = []) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return pool.query(text, params);
}
