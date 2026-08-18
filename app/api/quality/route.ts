import { NextResponse } from "next/server";
import { detectHype } from "@/lib/agent/hype";
import { matchTopics } from "@/data/ontology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live copy check for the studio: does this reel read as a lesson or a promise? */
export async function POST(request: Request) {
  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length < 8) {
    return NextResponse.json({ hype: { score: 0, blocked: false, kinds: [], matched: [] }, topics: [] });
  }

  return NextResponse.json({
    hype: detectHype(text.slice(0, 6000)),
    topics: matchTopics(text).slice(0, 6).map((t) => ({ id: t.id, label: t.label, category: t.category })),
  });
}
