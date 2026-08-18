import { NextResponse } from "next/server";
import { getReel } from "@/data/reels";
import { judgeReel } from "@/lib/agent/hype";
import { config } from "@/lib/config";
import { embedQuery } from "@/lib/embeddings";
import { indexInfo, searchVectors } from "@/lib/vector";
import { CATEGORIES, type Category } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Semantic search over the catalog. Plain English in, reels out — the same
 * vector path the agent's retrieval stage uses, exposed directly so the
 * retrieval quality is inspectable rather than taken on trust.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 12, 40);
  const categoryParam = url.searchParams.get("category");
  const category = CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : undefined;

  if (!query) {
    return NextResponse.json({ error: "Pass a query with ?q=" }, { status: 400 });
  }

  const started = Date.now();
  const { vector, provider, dims } = await embedQuery(query);
  const hits = await searchVectors(vector, limit, {
    lanes: ["catalog"],
    categories: category ? [category] : undefined,
  });

  const info = await indexInfo();

  return NextResponse.json({
    query,
    // The library shows the raw index, so each hit carries the verdict the agent
    // would reach. A reel the guardrail refuses must not look recommendable
    // just because it ranks well.
    results: hits
      .map((hit) => {
        const reel = getReel(hit.id);
        if (!reel) return null;
        const hype = judgeReel(reel);
        return {
          reel,
          score: Number(hit.score.toFixed(4)),
          blocked: hype.blocked || reel.substance < config.agent.substanceFloor,
          blockReason: hype.blocked
            ? `Hype — “${hype.matched[0] ?? hype.kinds[0]}”`
            : reel.substance < config.agent.substanceFloor
              ? `Below the substance floor (${reel.substance.toFixed(2)})`
              : null,
        };
      })
      .filter(Boolean),
    diagnostics: {
      provider,
      dims,
      store: info.store,
      indexed: info.count,
      ms: Date.now() - started,
    },
  });
}
