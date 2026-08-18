import { NextResponse } from "next/server";
import { detectHype } from "@/lib/agent/hype";
import { matchTopics } from "@/data/ontology";
import { qualityRequestSchema } from "@/lib/api/schemas";
import { parseJsonBody } from "@/lib/api/parse-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emptyHype = { score: 0, blocked: false, kinds: [] as string[], matched: [] as string[] };

/** Live copy check for the studio: does this reel read as a lesson or a promise? */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, qualityRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { text } = parsed.data;
  if (!text || text.length < 8) {
    return NextResponse.json({ hype: emptyHype, topics: [] });
  }

  return NextResponse.json({
    hype: detectHype(text.slice(0, 6000)),
    topics: matchTopics(text).slice(0, 6).map((t) => ({ id: t.id, label: t.label, category: t.category })),
  });
}
