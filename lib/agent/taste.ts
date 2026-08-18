import { TOPIC_BY_ID } from "@/data/ontology";
import { getReel } from "@/data/reels";
import { addScaled, normalize } from "@/lib/embeddings";
import { vectorFor } from "@/lib/vector";
import { DIFFICULTY_ORDER } from "@/data/ontology";
import type {
  Category,
  Genre,
  InteractionEvent,
  ReelAffinity,
  TasteFacet,
  TasteProfile,
} from "@/lib/types";
import { computeAffinities } from "./signals";

/* ---------------------------------------------------------------------------
   The taste profile.

   The taste vector is the centroid of what held attention, with what was
   pushed away subtracted out. Subtraction matters: without it, a student who
   skips every meme still gets memes recommended, because the memes they did
   watch dominate a positives-only centroid.

   Facets are the symbolic half. The vector knows "near these reels"; facets
   know "because of these topics", and the agent needs both — one to retrieve,
   one to explain.
--------------------------------------------------------------------------- */

/** Negatives pull, but not as hard as positives push — a skip is weaker evidence than a save. */
const NEGATIVE_WEIGHT = 0.55;

export interface BuildProfileOptions {
  sessionId: string;
  events: InteractionEvent[];
  now?: number;
}

export async function buildTasteProfile({
  sessionId,
  events,
  now = Date.now(),
}: BuildProfileOptions): Promise<TasteProfile> {
  const affinities = computeAffinities(events, now);

  let vector: number[] = [];
  const facetWeights = new Map<string, { weight: number; reels: Set<string> }>();
  const categories: Partial<Record<Category, number>> = {};
  const genres: Partial<Record<Genre, number>> = {};

  let difficultyNumerator = 0;
  let difficultyDenominator = 0;
  let positiveMass = 0;

  for (const affinity of affinities) {
    const reel = getReel(affinity.reelId);
    if (!reel) continue;

    const embedding = await vectorFor(reel.id);
    if (embedding) {
      const scale = affinity.score >= 0 ? affinity.score : affinity.score * NEGATIVE_WEIGHT;
      vector = addScaled(vector, embedding, scale);
    }

    if (affinity.score <= 0) {
      // Negative evidence still informs categories, as a suppression.
      categories[reel.category] = (categories[reel.category] ?? 0) + affinity.score * 0.5;
      genres[reel.genre] = (genres[reel.genre] ?? 0) + affinity.score * 0.5;
      continue;
    }

    positiveMass += affinity.score;
    categories[reel.category] = (categories[reel.category] ?? 0) + affinity.score;
    genres[reel.genre] = (genres[reel.genre] ?? 0) + affinity.score;

    // Difficulty preference is read from what holds attention, weighted by how
    // much of it was actually watched — not from what the student clicked on.
    difficultyNumerator += (DIFFICULTY_ORDER[reel.difficulty] / 2) * affinity.score;
    difficultyDenominator += affinity.score;

    for (const topicId of reel.topics) {
      const entry = facetWeights.get(topicId) ?? { weight: 0, reels: new Set<string>() };
      entry.weight += affinity.score;
      entry.reels.add(reel.id);
      facetWeights.set(topicId, entry);

      // A topic's parent interests inherit a fraction, which is what lets four
      // narrow topics add up to one broad one.
      const node = TOPIC_BY_ID.get(topicId);
      for (const lift of node?.liftsTo ?? []) {
        const parent = facetWeights.get(lift) ?? { weight: 0, reels: new Set<string>() };
        parent.weight += affinity.score * 0.3;
        parent.reels.add(reel.id);
        facetWeights.set(lift, parent);
      }
    }
  }

  const facets: TasteFacet[] = [...facetWeights.entries()]
    .map(([topic, { weight, reels }]) => ({
      topic,
      weight: Number(weight.toFixed(4)),
      evidenceReelIds: [...reels],
    }))
    .sort((a, b) => b.weight - a.weight);

  const watchedReelIds = affinities.map((a) => a.reelId);

  return {
    sessionId,
    vector: vector.length ? normalize(vector) : [],
    facets,
    categories,
    genres,
    difficultyBias: difficultyDenominator > 0 ? difficultyNumerator / difficultyDenominator : 0.3,
    // Three solid positive signals is enough to speak with confidence; below
    // that the agent should say it is guessing.
    signalStrength: Math.max(0, Math.min(1, positiveMass / 2.4)),
    affinities,
    watchedReelIds,
    updatedAt: new Date(now).toISOString(),
  };
}

/** Affinities that count as evidence, strongest first. */
export function positiveAffinities(profile: TasteProfile, limit = 6): ReelAffinity[] {
  return profile.affinities.filter((a) => a.score > 0.1).slice(0, limit);
}

export function negativeAffinities(profile: TasteProfile, limit = 4): ReelAffinity[] {
  return profile.affinities
    .filter((a) => a.score < -0.05)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

/** The categories worth naming, ordered, ignoring suppressed ones. */
export function rankedCategories(profile: TasteProfile): { category: Category; weight: number }[] {
  return (Object.entries(profile.categories) as [Category, number][])
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, weight]) => ({ category, weight }));
}

export function difficultyLabel(bias: number): "Beginner" | "Intermediate" | "Advanced" {
  if (bias < 0.34) return "Beginner";
  if (bias < 0.67) return "Intermediate";
  return "Advanced";
}
