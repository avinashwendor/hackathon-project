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
  /** Which tier is currently being served (profile → likes → more). */
  phase?: "profile" | "likes" | "more";
}

const ONBOARDING_REJECTION_REASONS = new Set([
  "not_relevant",
  "wrong_topic",
  "already_know",
]);

/** User rejected profile-based suggestions — advance to likes / generic tiers. */
function onboardingRejected(social: SocialState): boolean {
  const feedback = Object.values(social.dislikeFeedback ?? {});
  const profileRejections = feedback.filter((fb) =>
    ONBOARDING_REJECTION_REASONS.has(fb.reason),
  );
  return profileRejections.length >= 1 || social.dislikes.length >= 3;
}

type FeedTierKind = "profile" | "likes" | "more";

interface LabeledTier {
  kind: FeedTierKind;
  ids: string[];
}

function mergeTiers(tiers: LabeledTier[]): {
  ids: string[];
  tierBounds: { onboarding: number; likes: number };
} {
  const seen = new Set<string>();
  const ids: string[] = [];
  let onboarding = 0;
  let likes = 0;

  for (const tier of tiers) {
    for (const id of tier.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (tier.kind === "profile") onboarding++;
      else if (tier.kind === "likes") likes++;
    }
  }

  return { ids, tierBounds: { onboarding, likes: onboarding + likes } };
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

/** Queries from reels the user explicitly liked. */
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

async function searchToRankedIds(
  queries: string[],
  options: {
    categories?: Category[];
    hardExclude: Set<string>;
    mutedTopics: Set<string>;
    minSubstanceBoost?: number;
  },
): Promise<string[]> {
  const scores = await fuseSearch(queries, FEED_RANK_MAX, options);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter((id) => getReel(id)?.media.storageKey);
}

async function tasteRankedIds(
  sessionId: string,
  events: InteractionEvent[],
  social: SocialState,
  hardExclude: Set<string>,
  muted: Set<string>,
): Promise<string[]> {
  if (events.length < 2) return [];

  const profile = await buildTasteProfile({ sessionId, events });
  const ids: string[] = [];

  for (const facet of profile.facets.slice(0, 3)) {
    const node = TOPIC_BY_ID.get(facet.topic);
    if (!node) continue;
    const hits = await searchToRankedIds([`${node.label} — practical explainer`], {
      hardExclude,
      mutedTopics: muted,
    });
    ids.push(...hits);
  }

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
      if (social.likes.includes(hit.id)) continue;
      ids.push(hit.id);
    }
  }

  return ids;
}

function resolveActivePhase(
  rankIds: string[],
  tierBounds: { onboarding: number; likes: number } | undefined,
  softExclude: Set<string>,
): FeedResult["phase"] {
  if (!tierBounds) return "more";

  const firstUnseen = rankIds.find((id) => !softExclude.has(id));
  if (!firstUnseen) return "more";

  const idx = rankIds.indexOf(firstUnseen);
  if (idx < tierBounds.onboarding) return "profile";
  if (idx < tierBounds.likes) return "likes";
  return "more";
}

function sourceForPhase(phase: FeedResult["phase"]): FeedResult["source"] {
  switch (phase) {
    case "profile":
      return "onboarding";
    case "likes":
      return "taste";
    default:
      return "fallback";
  }
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
): Promise<{
  ids: string[];
  source: FeedResult["source"];
  queries: string[];
  tierBounds?: { onboarding: number; likes: number };
}> {
  const onboarding = social.onboarding;
  const muted = new Set(social.mutedTopics);
  const prefs = feedPreferences(social, onboarding);
  const searchOptions = {
    hardExclude,
    mutedTopics: muted,
    minSubstanceBoost: prefs.minSubstanceBoost,
  };

  const allQueries: string[] = [];
  const tierLists: LabeledTier[] = [];
  const skipProfile = onboardingRejected(social);

  // Tier 1 — profile / onboarding picks (shown first after signup).
  if (onboarding?.completedAt && !skipProfile) {
    const queries = onboardingQueries(onboarding);
    if (prefs.difficulty) {
      queries.push(`Practical ${prefs.difficulty.toLowerCase()} level technical explainer`);
    }
    allQueries.push(...queries);

    const profileIds = await searchToRankedIds(queries, {
      ...searchOptions,
      categories: prefs.categories ?? (onboarding.categories as Category[]),
    });
    tierLists.push({ kind: "profile", ids: profileIds });
  }

  // Tier 2 — reels similar to what the user liked (after profile tier or if rejected).
  const likeQueries = likedReelQueries(social);
  if (likeQueries.length) {
    allQueries.push(...likeQueries);
    const likeIds = await searchToRankedIds(likeQueries, {
      ...searchOptions,
      categories: prefs.categories,
    });
    tierLists.push({ kind: "likes", ids: likeIds });
  } else if (skipProfile && events.length >= 2) {
    // No likes yet but profile was rejected — use implicit watch taste.
    const tasteIds = await tasteRankedIds(sessionId, events, social, hardExclude, muted);
    if (tasteIds.length) tierLists.push({ kind: "likes", ids: tasteIds });
  }

  // Tier 3 — generic catalog (what you see when scrolling deep).
  tierLists.push({ kind: "more", ids: playableRankedIds(hardExclude) });

  const merged = mergeTiers(tierLists);
  const ids = merged.ids.slice(0, FEED_RANK_MAX);
  const tierBounds = merged.tierBounds;
  const phase: FeedResult["phase"] =
    tierBounds.onboarding > 0 && !skipProfile
      ? "profile"
      : likeQueries.length || tierLists.some((t) => t.kind === "likes" && t.ids.length)
        ? "likes"
        : "more";

  return {
    ids: ids.length ? ids : playableRankedIds(hardExclude),
    source: sourceForPhase(phase),
    queries: allQueries,
    tierBounds,
  };
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
  let tierBounds = social.feedRank?.tierBounds;
  let queries: string[] = [];

  if (needsRebuild) {
    const built = await buildRankedIds(sessionId, social, events, hardExclude);
    rankIds = built.ids;
    source = built.source;
    tierBounds = built.tierBounds;
    queries = built.queries;

    const cache: FeedRankCache = {
      ids: rankIds,
      builtAt: new Date().toISOString(),
      source,
      likeCount,
      tierBounds,
    };
    await updateSocial(sessionId, (current) => ({ ...current, feedRank: cache }));
  }

  let { reels, hasMore } = sliceFromRank(rankIds, softExclude, hardExclude, limit);

  if (!reels.length && !needsRebuild) {
    const built = await buildRankedIds(sessionId, social, events, hardExclude);
    rankIds = built.ids;
    source = built.source;
    tierBounds = built.tierBounds;
    queries = built.queries;
    await updateSocial(sessionId, (current) => ({
      ...current,
      feedRank: {
        ids: rankIds,
        builtAt: new Date().toISOString(),
        source,
        likeCount,
        tierBounds,
      },
    }));
    ({ reels, hasMore } = sliceFromRank(rankIds, softExclude, hardExclude, limit));
  }

  const phase = resolveActivePhase(rankIds, tierBounds, softExclude);
  source = sourceForPhase(phase);

  return { reels, source, queries, hasMore, phase };
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
