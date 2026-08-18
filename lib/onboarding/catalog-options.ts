/**
 * Onboarding options derived from the live catalog — not the full ontology.
 * Source of truth: data/generated/onboarding-options.json (regenerate via
 * `node scripts/generate-onboarding-options.mjs` after catalog changes).
 */

import options from "@/data/generated/onboarding-options.json";
import { MOTIVATIONS, TOPIC_BY_ID } from "@/data/ontology";
import type { Category, Difficulty } from "@/lib/types";

export interface CatalogTopicOption {
  id: string;
  label: string;
  category: Category;
  reelCount: number;
  domain: string;
}

export interface OnboardingCluster {
  id: string;
  label: string;
  description: string;
  topicIds: string[];
  reelCount: number;
}

export const CATALOG_TOPICS = options.catalogTopics as CatalogTopicOption[];
export const CATALOG_TOPIC_IDS = new Set(options.catalogTopicIds);
export const ONBOARDING_CLUSTERS = options.clusters as OnboardingCluster[];
export const VIABLE_CATEGORIES = options.viableCategories as {
  category: Category;
  reelCount: number;
  label: string;
}[];
export const VIABLE_DIFFICULTIES = options.viableDifficulties as Difficulty[];

export const MOTIVATION_OPTIONS = Object.entries(MOTIVATIONS).map(([key, label]) => ({
  key,
  label,
}));

/** Topics available after the user picks clusters. */
export function topicsForClusters(clusterIds: string[]): CatalogTopicOption[] {
  const ids = new Set<string>();
  for (const cluster of ONBOARDING_CLUSTERS) {
    if (clusterIds.includes(cluster.id)) {
      for (const id of cluster.topicIds) ids.add(id);
    }
  }
  return CATALOG_TOPICS.filter((t) => ids.has(t.id));
}

/** Derive category list from selected topic ids (for feed API filters). */
export function categoriesFromTopics(topicIds: string[]): Category[] {
  const cats = new Set<Category>();
  for (const id of topicIds) {
    const node = TOPIC_BY_ID.get(id);
    if (node) cats.add(node.category);
  }
  return [...cats];
}

export function isValidOnboarding(input: {
  clusterIds: string[];
  topics: string[];
  motivation: string;
  difficulty: string;
  goal: string;
}): string | null {
  const clusterIds = new Set(ONBOARDING_CLUSTERS.map((c) => c.id));

  if (!input.clusterIds.length) return "Pick at least one learning area.";
  if (input.clusterIds.length > 4) return "Pick at most four learning areas.";
  if (!input.clusterIds.every((id) => clusterIds.has(id))) {
    return "One or more learning areas are not available.";
  }
  return validateOnboardingCore({ ...input, clusterIds: input.clusterIds });
}

/** Legacy API clients that send categories instead of clusters. */
export function isValidLegacyOnboarding(input: {
  topics: string[];
  motivation: string;
  difficulty: string;
  goal: string;
}): string | null {
  return validateOnboardingCore(input);
}

function validateOnboardingCore(input: {
  clusterIds?: string[];
  topics: string[];
  motivation: string;
  difficulty: string;
  goal: string;
}): string | null {
  if (!input.topics.length) return "Pick at least one topic.";
  if (input.topics.length > 8) return "Pick at most eight topics.";
  if (!input.topics.every((t) => CATALOG_TOPIC_IDS.has(t))) {
    return "One or more topics are not in the catalog.";
  }
  if (input.clusterIds?.length) {
    const allowedTopics = new Set(topicsForClusters(input.clusterIds).map((t) => t.id));
    if (!input.topics.every((t) => allowedTopics.has(t))) {
      return "Topics must match your selected learning areas.";
    }
  }
  if (!(input.motivation in MOTIVATIONS)) return "Unknown motivation.";
  if (!VIABLE_DIFFICULTIES.includes(input.difficulty as Difficulty)) {
    return `Difficulty must be one of: ${VIABLE_DIFFICULTIES.join(", ")}`;
  }
  if (input.goal.trim().length < 4) return "Describe your goal in a few words.";
  return null;
}

/** Fields the AI actually reads — for docs and debugging. */
export const AI_INDEXED_REEL_FIELDS = [
  "title",
  "caption",
  "transcript",
  "category",
  "difficulty",
  "topics (ontology ids)",
  "outcome",
  "prerequisites",
  "hashtags",
  "substance (guardrail floor)",
  "hypeMarkers (guardrail block)",
  "lane (catalog | feed | both)",
  "genre (meme | coding | news | …)",
] as const;

export const AI_BEHAVIOR_FIELDS = [
  "onboarding.goal → semantic search query",
  "onboarding.topics → semantic search queries",
  "onboarding.motivation → semantic search query",
  "onboarding.difficulty → search query + difficulty fit",
  "interaction events → taste vector + facets",
  "social.likes / saves / dislikes → retrieval filter + taste",
  "social.follows → retrieval boost",
] as const;

export const catalogStats = {
  total: options.totalReels,
};
