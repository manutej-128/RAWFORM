import { improve } from "@/lib/humanize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 120_000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Could not read the request." }, { status: 400 });
  }

  const text = (body as { text?: unknown } | null)?.text;

  if (typeof text !== "string" || !text.trim()) {
    return Response.json(
      { error: "Paste or type something before running Humanize." },
      { status: 400 }
    );
  }

  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: `That is longer than the rewriter handles (${MAX_CHARS.toLocaleString()} characters).` },
      { status: 413 }
    );
  }

  const result = improve(text);

  // Rewritten in memory and returned. Nothing here is written or logged.
  return Response.json(result);
}
