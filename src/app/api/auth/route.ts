import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The only thing RAWFORM ever stores: a name and an email.
 * No writing, no revisions, no scores, no history.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Could not read the request." }, { status: 400 });
  }

  const payload = body as { name?: unknown; email?: unknown } | null;
  const name = typeof payload?.name === "string" ? payload.name.trim().slice(0, 120) : "";
  const email = typeof payload?.email === "string" ? payload.email.trim().slice(0, 254) : "";

  if (!name || !email) {
    return Response.json({ error: "Enter your name and email." }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return Response.json({ error: "That email address does not look right." }, { status: 400 });
  }

  if (!isDatabaseConfigured) {
    return Response.json({ ok: true, stored: false, reason: "no-database" });
  }

  try {
    const db = getDb();
    if (!db) return Response.json({ ok: true, stored: false, reason: "no-database" });

    await db.insert(users).values({ name, email }).onConflictDoNothing();
    return Response.json({ ok: true, stored: true });
  } catch {
    // The session continues whether or not the row was written.
    return Response.json({ ok: true, stored: false, reason: "unreachable" });
  }
}
