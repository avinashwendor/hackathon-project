import { MOTIVATIONS, TOPIC_BY_ID } from "@/data/ontology";
import { getReel, resolveReelsMedia } from "@/data/reels";
import { judgeReel } from "@/lib/agent/hype";
import { buildTasteProfile } from "@/lib/agent/taste";
import { config } from "@/lib/config";
import {
  FEED_RANK_MAX,
  feedRankStale,
} from "@/lib/feed/feed-cache";
import { embedQueries } from "@/lib/embeddings";
import type { InteractionEvent, OnboardingPreferences, SocialState } from "@/lib/store/types";
import { readEvents, readSocial, updateSocial } from "@/lib/store";
import type { FeedRankCache } from "@/lib/feed/feed-cache";
import type { Category, Difficulty, Reel } from "@/lib/types";
import { searchVectors } from "@/lib/vector";

export interface FeedOptions {
  limit?: number;
  excludeIds?: string[];
  /** Rebuild rank from likes/taste (after ~3 likes). */
  refresh?: boolean;
}

export interface FeedResult {
  reels: Reel[];
  source: "onboarding" | "taste" | "blended" | "fallback";
  queries: string[];
  hasMore: boolean;
}

const PAGE_DEFAULT = 5;

function onboardingQueries(prefs: OnboardingPreferences): string[] {
  const motivation =
    MOTIVATIONS[prefs.motivation as keyof typeof MOTIVATIONS] ?? prefs.motivation;
  const topicLabels = prefs.topics
    .map((id) => TOPIC_BY_ID.get(id)?.label ?? id)
    .filter(Boolean);

  return [
    ...new Set(
      [
        prefs.goal.trim(),
        `${motivation}. Focus: ${topicLabels.join(", ") || prefs.categories.join(", ")}`,
        ...prefs.categories.map(
          (c) => `Practical ${c} explainer for ${prefs.difficulty} level`,
        ),
        ...topicLabels.slice(0, 4).map((label) => `${label} tutorial with a concrete takeaway`),
      ].filter((q) => q && q.trim().length > 4),
    ),
  ];
}

/** Queries from reels the user explicitly liked — kicks in after 2+ likes. */
function likedReelQueries(social: SocialState): string[] {
  const queries: string[] = [];
  for (const reelId of social.likes.slice(-5)) {
    const reel = getReel(reelId);
    if (!reel) continue;
    const topicLabels = reel.topics
      .map((id) => TOPIC_BY_ID.get(id)?.label ?? id)
      .slice(0, 2);
    if (topicLabels.length) {
      queries.push(`More like ${topicLabels.join(" and ")} — ${reel.category} explainer`);
    }
  }
  return queries.slice(-3);
}

function feedPreferences(social: SocialState, onboarding?: OnboardingPreferences | null): {
  categories?: Category[];
  difficulty?: Difficulty;
  minSubstanceBoost: number;
  avoidQueries: string[];
} {
  let difficulty = onboarding?.difficulty as Difficulty | undefined;
  let minSubstanceBoost = 0;
  const avoidQueries: string[] = [];

  for (const [reelId, fb] of Object.entries(social.dislikeFeedback ?? {})) {
    if (fb.reason === "too_basic") difficulty = "Intermediate";
    if (fb.reason === "too_advanced") difficulty = "Beginner";
    if (fb.reason === "too_much_hype") minSubstanceBoost += 0.08;
    if (fb.reason === "other" && fb.detail) avoidQueries.push(fb.detail);
    const reel = getReel(reelId);
    if (reel && fb.reason === "wrong_topic") {
      avoidQueries.push(`Avoid ${reel.category} content like: ${reel.title}`);
    }
  }

  const categories = onboarding?.categories?.length
    ? (onboarding.categories as Category[])
    : undefined;

  return { categories, difficulty, minSubstanceBoost, avoidQueries };
}

/** Hard exclude — never rank these. Soft exclude (seen/watched) applied when slicing. */
export function collectHardExclude(social: SocialState, extra: string[] = []): Set<string> {
  return new Set([...social.dislikes, ...extra]);
}

export function collectSoftExclude(
  social: SocialState,
  events: InteractionEvent[],
  extra: string[] = [],
): Set<string> {
  const soft = new Set([...(social.seenReels ?? []), ...extra]);
  for (const event of events) {
    soft.add(event.reelId);
  }
  return soft;
}

async function fuseSearch(
  queries: string[],
  poolSize: number,
  options: {
    categories?: Category[];
    hardExclude: Set<string>;
    mutedTopics: Set<string>;
    minSubstanceBoost?: number;
  },
): Promise<Map<string, number>> {
  if (!queries.length) return new Map();

  const { vectors } = await embedQueries(queries);
  const scores = new Map<string, number>();
  const substanceFloor =
    config.agent.substanceFloor * 0.85 + (options.minSubstanceBoost ?? 0);

  for (const vector of vectors) {
    const hits = await searchVectors(vector, poolSize * 2, {
      lanes: ["catalog", "both"],
      categories: options.categories,
      minSubstance: Math.min(0.95, substanceFloor),
      excludeHyped: true,
    });
    for (const hit of hits) {
      if (options.hardExclude.has(hit.id)) continue;
      const reel = getReel(hit.id);
      if (!reel?.media.storageKey) continue;
      if (reel.topics.some((t) => options.mutedTopics.has(t))) continue;
      const hype = judgeReel(reel);
      if (hype.blocked || reel.substance < config.agent.substanceFloor) continue;
      scores.set(hit.id, Math.max(scores.get(hit.id) ?? 0, hit.score));
    }
  }

  return scores;
}

function playableRankedIds(hardExclude: Set<string>): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= 230 && ids.length < FEED_RANK_MAX; i++) {
    const reel = getReel(`reel_${String(i).padStart(6, "0")}`);
    if (reel?.media.storageKey && !hardExclude.has(reel.id)) ids.push(reel.id);
  }
  return ids;
}

async function buildRankedIds(
  sessionId: string,
  social: SocialState,
  events: InteractionEvent[],
  hardExclude: Set<string>,
): Promise<{ ids: string[]; source: FeedResult["source"]; queries: string[] }> {
  const onboarding = social.onboarding;
  const muted = new Set(social.mutedTopics);
  const textQueries: string[] = [];
  let source: FeedResult["source"] = "fallback";

  if (onboarding?.completedAt) {
    textQueries.push(...onboardingQueries(onboarding));
    source = "onboarding";
  }

  if (social.likes.length >= 2) {
    textQueries.push(...likedReelQueries(social));
    source = onboarding ? "blended" : "taste";
  }

  if (events.length >= 2) {
    const profile = await buildTasteProfile({ sessionId, events });
    for (const facet of profile.facets.slice(0, 3)) {
      const node = TOPIC_BY_ID.get(facet.topic);
      if (node) textQueries.push(`${node.label} — practical explainer`);
    }
    source = onboarding || social.likes.length >= 2 ? "blended" : "taste";
  }

  const prefs = feedPreferences(social, onboarding);
  if (prefs.difficulty) {
    textQueries.push(`Practical ${prefs.difficulty.toLowerCase()} level technical explainer`);
  }
  for (const avoid of prefs.avoidQueries.slice(0, 2)) {
    textQueries.push(avoid);
  }

  if (!textQueries.length) {
    return { ids: playableRankedIds(hardExclude), source: "fallback", queries: [] };
  }

  const categories = onboarding?.categories?.length
    ? (onboarding.categories as Category[])
    : undefined;

  const scores = await fuseSearch(textQueries, FEED_RANK_MAX, {
    categories: prefs.categories ?? categories,
    hardExclude,
    mutedTopics: muted,
    minSubstanceBoost: prefs.minSubstanceBoost,
  });

  if (events.length >= 2) {
    const profile = await buildTasteProfile({ sessionId, events });
    if (profile.vector.length) {
      const tasteHits = await searchVectors(profile.vector, FEED_RANK_MAX, {
        lanes: ["catalog", "both"],
        minSubstance: config.agent.substanceFloor * 0.85,
        excludeHyped: true,
      });
      for (const hit of tasteHits) {
        if (hardExclude.has(hit.id)) continue;
        const reel = getReel(hit.id);
        if (!reel?.media.storageKey || reel.topics.some((t) => muted.has(t))) continue;
        const boost = social.likes.includes(hit.id) ? 0 : 1;
        if (boost === 0) continue;
        scores.set(hit.id, Math.max(scores.get(hit.id) ?? 0, hit.score * 0.95));
      }
    }
  }

  const ids = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter((id) => getReel(id)?.media.storageKey);

  if (!ids.length) {
    return { ids: playableRankedIds(hardExclude), source: "fallback", queries: textQueries };
  }

  return { ids, source, queries: textQueries };
}

function unseenPlayableIds(
  rankIds: string[],
  softExclude: Set<string>,
  hardExclude: Set<string>,
): string[] {
  const fromRank = rankIds.filter((id) => !softExclude.has(id) && !hardExclude.has(id));
  if (fromRank.length) return fromRank;

  return playableRankedIds(hardExclude).filter((id) => !softExclude.has(id));
}

function sliceFromRank(
  rankIds: string[],
  softExclude: Set<string>,
  hardExclude: Set<string>,
  limit: number,
): { reels: Reel[]; hasMore: boolean } {
  const available = unseenPlayableIds(rankIds, softExclude, hardExclude);
  const picked = available.slice(0, limit);
  const reels = resolveReelsMedia(
    picked.map((id) => getReel(id)).filter((r): r is Reel => Boolean(r)),
  );
  return { reels, hasMore: available.length > picked.length };
}

/** Personalized feed — cached rank for speed; taste refresh after likes. */
export async function buildPersonalizedFeed(
  sessionId: string,
  options: FeedOptions = {},
): Promise<FeedResult> {
  const limit = Math.min(options.limit ?? PAGE_DEFAULT, 10);
  const [social, events] = await Promise.all([readSocial(sessionId), readEvents(sessionId)]);
  const hardExclude = collectHardExclude(social, options.excludeIds ?? []);
  const softExclude = collectSoftExclude(social, events, options.excludeIds ?? []);
  const likeCount = social.likes.length;
  const needsRebuild = feedRankStale(social.feedRank, likeCount, Boolean(options.refresh));

  let rankIds = social.feedRank?.ids ?? [];
  let source = social.feedRank?.source ?? "fallback";
  let queries: string[] = [];

  if (needsRebuild) {
    const built = await buildRankedIds(sessionId, social, events, hardExclude);
    rankIds = built.ids;
    source = built.source;
    queries = built.queries;

    const cache: FeedRankCache = {
      ids: rankIds,
      builtAt: new Date().toISOString(),
      source,
      likeCount,
    };
    await updateSocial(sessionId, (current) => ({ ...current, feedRank: cache }));
  }

  let { reels, hasMore } = sliceFromRank(rankIds, softExclude, hardExclude, limit);

  if (!reels.length && !needsRebuild) {
    const built = await buildRankedIds(sessionId, social, events, hardExclude);
    rankIds = built.ids;
    source = built.source;
    queries = built.queries;
    await updateSocial(sessionId, (current) => ({
      ...current,
      feedRank: {
        ids: rankIds,
        builtAt: new Date().toISOString(),
        source,
        likeCount,
      },
    }));
    ({ reels, hasMore } = sliceFromRank(rankIds, softExclude, hardExclude, limit));
  }

  return { reels, source, queries, hasMore };
}

/** Server pages + API: build feed and mark returned reels as seen. */
export async function prefetchFeed(
  sessionId: string,
  options: FeedOptions = {},
): Promise<FeedResult> {
  const result = await buildPersonalizedFeed(sessionId, options);
  if (result.reels.length) {
    await updateSocial(sessionId, (current) => ({
      ...current,
      seenReels: [
        ...new Set([...(current.seenReels ?? []), ...result.reels.map((r) => r.id)]),
      ].slice(-800),
    }));
  }
  return result;
}

/** @deprecated use collectHardExclude + collectSoftExclude */
export function collectExcludedIds(
  social: SocialState,
  events: InteractionEvent[],
  extra: string[] = [],
): Set<string> {
  const all = collectSoftExclude(social, events, extra);
  for (const id of social.dislikes) all.add(id);
  return all;
}
