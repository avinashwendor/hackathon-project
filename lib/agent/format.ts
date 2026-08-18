import type { AgentResult, BaselineResult, RecommendationCard } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The required output block.

   The brief specifies eight fields in a fixed order. This renders exactly that,
   from the same object the UI reads, so the pretty view and the plain-text view
   can never drift apart.
--------------------------------------------------------------------------- */

export const CARD_FIELDS = [
  "CURRENT REEL",
  "INTEREST DETECTED",
  "WHY",
  "RECOMMENDED TECH REEL",
  "CATEGORY",
  "WHY THIS RECOMMENDATION",
  "DIFFICULTY",
  "CONFIDENCE",
] as const;

export function formatCard(card: RecommendationCard): string {
  const rows: [string, string][] = [
    ["CURRENT REEL", card.currentReel],
    ["INTEREST DETECTED", card.interestDetected],
    ["WHY", card.why],
    ["RECOMMENDED TECH REEL", card.recommendedTechReel],
    ["CATEGORY", card.category],
    ["WHY THIS RECOMMENDATION", card.whyThisRecommendation],
    ["DIFFICULTY", card.difficulty],
    ["CONFIDENCE", card.confidence],
  ];
  return rows.map(([label, value]) => `* ${label}: ${value}`).join("\n");
}

/** A compact single-line summary for logs and the feed's inline chip. */
export function summarise(result: AgentResult | BaselineResult): string {
  return `${result.card.interestDetected} → ${result.card.recommendedTechReel} (${result.card.category}, ${result.card.confidence})`;
}
