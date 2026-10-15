import { getDb, isDatabaseConfigured } from "@/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The app is healthy when it can score text. The database only stores the
 * sign-in name and email, so its absence is reported, never fatal.
 */
export async function GET() {
  let database: "connected" | "unreachable" | "not-configured" = "not-configured";

  if (isDatabaseConfigured) {
    try {
      const db = getDb();
      if (db) {
        await db.execute(sql`select 1`);
        database = "connected";
      }
    } catch {
      database = "unreachable";
    }
  }

  return Response.json({ ok: true, detector: "ready", database });
}
