import { Pool } from "pg";

const globalForPg = globalThis;
const pool = globalForPg.pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query(text, params = []) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return pool.query(text, params);
}
