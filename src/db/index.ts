import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * The database holds one thing: the name and email from the sign-in step.
 * It is optional on purpose. Until a real DATABASE_URL is supplied the app
 * runs in full, the sign-in simply does not persist, and nothing throws.
 */

const PLACEHOLDERS = new Set([
  "",
  "YOUR_NEW_NEON_CONNECTION_STRING",
  "your_new_neon_connection_string",
]);

function readUrl(): string | null {
  const raw = (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
  if (PLACEHOLDERS.has(raw)) return null;
  if (!/^postgres(ql)?:\/\//i.test(raw)) return null;
  return raw;
}

export const databaseUrl = readUrl();
export const isDatabaseConfigured = databaseUrl !== null;

type GlobalWithPool = typeof globalThis & {
  __rawformPool?: Pool;
  __rawformDb?: NodePgDatabase;
};

const globalForDb = globalThis as GlobalWithPool;

/** The Drizzle client, or null when no connection string is configured. */
export function getDb(): NodePgDatabase | null {
  if (!databaseUrl) return null;

  if (!globalForDb.__rawformPool) {
    // Hosted Postgres (Neon included) presents a publicly trusted certificate,
    // so TLS is verified rather than waved through. A local socket needs none.
    const needsTls = /neon\.tech|sslmode=require|sslmode=verify/i.test(databaseUrl);

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: needsTls ? { rejectUnauthorized: true } : undefined,
      // Serverless runs many short-lived instances, so each one holds a
      // couple of connections at most. Use Neon's pooled host in production.
      max: 2,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    // A pool-level error must never take the process down.
    pool.on("error", () => undefined);
    globalForDb.__rawformPool = pool;
    globalForDb.__rawformDb = drizzle(pool);
  }

  return globalForDb.__rawformDb ?? null;
}
