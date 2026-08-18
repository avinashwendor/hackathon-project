import { getReel, recommendableReels } from "@/data/reels";
import type { BaselineResult, InteractionEvent, Reel } from "@/lib/types";
import { formatCard } from "./format";
import { judgeReel } from "./hype";

/* ---------------------------------------------------------------------------
   The shallow baseline.

   This is deliberately a competent version of the naive approach, not a straw
   man: TF-IDF-ish keyword overlap against the current reel, boosted by
   engagement, which is roughly what a weekend recommender actually does. It has
   no notion of a person — only of a document — and no guardrail at all.

   It exists so the comparison page shows a real difference rather than an
   asserted one, and so the trap in the brief can be demonstrated failing.
--------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  "the","a","an","and","or","but","to","of","in","on","for","with","as","at","by","from","it","is",
  "are","was","were","be","this","that","you","your","i","we","they","my","me","not","no","so","do",
  "does","did","just","can","will","would","should","have","has","had","what","when","where","which",
  "who","how","why","up","out","about","into","than","too","very","one","two","get","got","like",
  "because","there","their","them","if","then","every","all","more","most","its","he","she",
]);

function keywords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#]+/)) {
    const token = raw.trim();
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function documentOf(reel: Reel): string {
  return `${reel.title} ${reel.caption} ${reel.hashtags.join(" ")} ${reel.transcript}`;
}

/** Log-scaled popularity, so a 9M-play reel does not simply always win. */
function engagementBoost(reel: Reel): number {
  return Math.log10(1 + reel.stats.plays) / 8;
}

export function recommendShallow(currentReel: Reel, events: InteractionEvent[] = []): BaselineResult {
  const queryTerms = keywords(documentOf(currentReel));
  const watched = new Set(events.map((e) => e.reelId));

  let best: { reel: Reel; score: number; overlap: string[] } | null = null;

  for (const candidate of recommendableReels()) {
    if (candidate.id === currentReel.id || watched.has(candidate.id)) continue;

    const candidateTerms = keywords(documentOf(candidate));
    const overlap: string[] = [];
    let score = 0;
    for (const [term, count] of queryTerms) {
      const other = candidateTerms.get(term);
      if (!other) continue;
      overlap.push(term);
      score += Math.min(count, other);
    }
    // Normalise by length so long transcripts do not win by volume alone.
    const normalised = score / Math.sqrt(candidateTerms.size || 1);
    const total = normalised + engagementBoost(candidate);

    if (!best || total > best.score) {
      best = { reel: candidate, score: total, overlap: overlap.slice(0, 8) };
    }
  }

  const fallbackReel = recommendableReels()[0];
  const pick = best?.reel ?? fallbackReel;
  const matchedKeywords = best?.overlap ?? [];

  const topKeyword =
    matchedKeywords[0] ?? currentReel.topics[0] ?? currentReel.category.toLowerCase();

  const card = {
    currentReel: `${currentReel.title} (${currentReel.creator.handle})`,
    interestDetected: topKeyword.charAt(0).toUpperCase() + topKeyword.slice(1),
    why: `The current reel contains the terms ${matchedKeywords.slice(0, 4).map((k) => `"${k}"`).join(", ") || "in its caption"}, and this candidate shares them.`,
    recommendedTechReel: pick.title,
    category: pick.category,
    whyThisRecommendation: `Highest keyword overlap with the current reel (${matchedKeywords.length} shared terms) and strong engagement (${(pick.stats.plays / 1_000_000).toFixed(1)}M plays).`,
    difficulty: pick.difficulty,
    confidence: "High" as const,
  };

  const critique: string[] = [];
  const hype = judgeReel(pick);

  if (hype.blocked) {
    critique.push(
      `Served hype content — "${hype.matched[0] ?? hype.kinds[0]}" — because engagement is the only quality signal it has.`,
    );
  }
  if (pick.substance < 0.4) {
    critique.push(`Recommended a reel with substance ${pick.substance.toFixed(2)}: nothing to learn from it.`);
  }
  const sharedTopics = pick.topics.filter((t) => currentReel.topics.includes(t));
  if (sharedTopics.length && pick.topics.every((t) => currentReel.topics.includes(t))) {
    critique.push(`Stayed inside "${sharedTopics.join(", ")}" — more of the same rather than a step forward.`);
  }
  if (events.length === 0) {
    critique.push("Used only the current reel. The other reels the student watched had no influence at all.");
  } else {
    critique.push(`Ignored ${events.length} interaction signals — watch time, saves and skips were never read.`);
  }
  critique.push("Reported High confidence, because keyword overlap has no way to express doubt.");

  return {
    card,
    formatted: formatCard(card),
    method: "TF keyword overlap on the current reel + log-scaled engagement",
    matchedKeywords,
    recommendation: pick,
    critique,
  };
}

export function shallowFor(currentReelId: string, events: InteractionEvent[] = []): BaselineResult | null {
  const reel = getReel(currentReelId);
  return reel ? recommendShallow(reel, events) : null;
}
