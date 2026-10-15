import { analyse } from "@/lib/deslop";

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
      { error: "Paste or type something before running the check." },
      { status: 400 }
    );
  }

  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: `That is longer than this check handles (${MAX_CHARS.toLocaleString()} characters).` },
      { status: 413 }
    );
  }

  const report = analyse(text);

  if (!report) {
    return Response.json(
      { error: "There are no readable words in that text to score." },
      { status: 400 }
    );
  }

  // The text is scored and discarded. Nothing here is written or logged.
  return Response.json(report);
}
