import { DIFFICULTY_ORDER, TOPIC_BY_ID } from "@/data/ontology";
import { getReel, recommendableReels } from "@/data/reels";
import { config } from "@/lib/config";
import { cosine, embedQueries } from "@/lib/embeddings";
import { searchVectors, vectorFor } from "@/lib/vector";
import type {
  InterestInference,
  Reel,
  RejectedCandidate,
  ScoredCandidate,
  TasteProfile,
} from "@/lib/types";
import type { SocialState } from "@/lib/store";
import { judgeReel } from "./hype";
import { difficultyLabel } from "./taste";

/* ---------------------------------------------------------------------------
   Retrieval.

   A single query embedding is not enough here. The inferred interest is a
   sentence about a person ("orienting toward a first engineering job"), which
   does not sit near any particular reel. So we fan out: the interest, the
   motivation, each secondary interest, and the taste centroid all search
   independently, and the results are fused.

   Fusion is by best score rather than reciprocal rank, because we care how
   close the best match was, not just that it ranked first for one query.
--------------------------------------------------------------------------- */

export interface RetrievalInput {
  currentReel: Reel;
  profile: TasteProfile;
  inference: InterestInference;
  /** Extra ids to keep out — usually everything already recommended this session. */
  exclude?: string[];
  /** Follows, dislikes and muted topics. Explicit intent, so it outranks inference. */
  social?: SocialState;
}

export interface RetrievalOutput {
  candidates: ScoredCandidate[];
  rejected: RejectedCandidate[];
  queries: string[];
  poolSize: number;
}

function buildQueries(input: RetrievalInput): string[] {
  const { inference, currentReel } = input;
  const queries = [
    inference.primaryInterest,
    `${inference.primaryInterest}. ${inference.underlyingMotivation}`,
    ...inference.secondaryInterests.slice(0, 2),
  ];

  // A capability query: what should they be able to do next? This is what pulls
  // in reels that teach rather than reels that merely match.
  queries.push(
    `Practical technical explainer that teaches a concrete skill in ${inference.primaryInterest}, ` +
      `for someone at ${difficultyLabel(input.profile.difficultyBias)} level`,
  );

  // One query anchored on the current reel's domain — enough to stay coherent
  // with what they are watching without collapsing onto its exact subtopic.
  const domain = currentReel.topics
    .map((t) => TOPIC_BY_ID.get(t)?.domain)
    .find(Boolean);
  if (domain) queries.push(`${domain} explained properly, with a real takeaway`);

  return [...new Set(queries.filter((q) => q && q.trim().length > 3))];
}

function difficultyFit(reel: Reel, bias: number): number {
  const target = bias * 2;
  const distance = Math.abs(DIFFICULTY_ORDER[reel.difficulty] - target);
  // One step away is still fine — stretch is good. Two steps is a bounce.
  return Math.max(0, 1 - distance / 1.8);
}

export async function retrieve(input: RetrievalInput): Promise<RetrievalOutput> {
  const { currentReel, profile, inference } = input;
  const queries = buildQueries(input);
  const { vectors } = await embedQueries(queries);

  const exclude = new Set([
    currentReel.id,
    ...profile.watchedReelIds,
    ...(input.exclude ?? []),
  ]);

  // Best similarity any query achieved, per reel.
  const best = new Map<string, { score: number; query: string }>();

  for (let i = 0; i < vectors.length; i++) {
    const hits = await searchVectors(vectors[i], config.agent.retrievalK, {
      lanes: ["catalog"],
    });
    for (const hit of hits) {
      const current = best.get(hit.id);
      if (!current || hit.score > current.score) {
        best.set(hit.id, { score: hit.score, query: queries[i] });
      }
    }
  }

  // The taste centroid searches too — it encodes the negatives, which no
  // written query does.
  if (profile.vector.length) {
    const hits = await searchVectors(profile.vector, config.agent.retrievalK, { lanes: ["catalog"] });
    for (const hit of hits) {
      const current = best.get(hit.id);
      // Weighted slightly below explicit queries: the centroid is a blur of
      // everything, so it is a good tiebreaker and a poor primary signal.
      const score = hit.score * 0.92;
      if (!current || score > current.score) best.set(hit.id, { score, query: "taste centroid" });
    }
  }

  const rejected: RejectedCandidate[] = [];
  const scored: ScoredCandidate[] = [];
  const currentSubtopics = new Set(currentReel.topics);

  const follows = new Set(input.social?.follows ?? []);
  const dislikes = new Set(input.social?.dislikes ?? []);
  const mutedTopics = new Set(input.social?.mutedTopics ?? []);

  for (const [reelId, { score: similarity, query }] of best) {
    const reel = getReel(reelId);
    if (!reel) continue;

    if (exclude.has(reelId)) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "already-seen",
        detail: "Already watched in this session.",
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    // Explicit rejection is the strongest signal there is. A dislike removes
    // the reel outright, and the topics it muted remove its neighbours — a
    // suppression that does not generalise just serves the same thing again.
    if (dislikes.has(reelId)) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "off-interest",
        detail: "You marked this reel as not interesting.",
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    const mutedHit = reel.topics.filter((t) => mutedTopics.has(t));
    // A muted topic only blocks when it is what the reel is mostly about;
    // otherwise one dislike would quietly delete half the catalogue.
    if (mutedHit.length && mutedHit.length >= Math.ceil(reel.topics.length / 2)) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "off-interest",
        detail: `Muted after you disliked similar content (${mutedHit.join(", ")}).`,
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    const hype = judgeReel(reel);
    if (hype.blocked) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "hype",
        detail: hype.matched.length
          ? `Promises an outcome instead of teaching one — "${hype.matched[0]}" (${hype.kinds.join(", ")}).`
          : `Reads as hype (${hype.kinds.join(", ")}).`,
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    if (reel.substance < config.agent.substanceFloor) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "low-substance",
        detail: `Nothing transferable in it — substance ${reel.substance.toFixed(2)}, below the ${config.agent.substanceFloor} floor.`,
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    // The anti-shallow rule. Once breadth is detected, a candidate that only
    // repeats the current reel's exact subtopic is exactly the trap.
    const overlap = reel.topics.filter((t) => currentSubtopics.has(t));
    const onlyOverlap = overlap.length > 0 && reel.topics.every((t) => currentSubtopics.has(t));
    if (inference.breadthDetected && onlyOverlap && reel.substance < 0.8) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "same-subtopic",
        detail: `Only connection is "${overlap.join(", ")}" — the same narrow topic they just watched, while their history is broader.`,
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    const tasteFit = profile.vector.length
      ? Math.max(0, cosine(profile.vector, (await vectorFor(reelId)) ?? []))
      : 0;
    const fit = difficultyFit(reel, profile.difficultyBias);

    if (fit < 0.2) {
      rejected.push({
        reelId,
        title: reel.title,
        reason: "difficulty-mismatch",
        detail: `${reel.difficulty} content for a ${difficultyLabel(profile.difficultyBias).toLowerCase()}-level viewer.`,
        wouldHaveScored: Number(similarity.toFixed(3)),
      });
      continue;
    }

    const reasons: string[] = [];
    if (similarity > 0.5) reasons.push(`close match to "${query}"`);
    if (reel.outcome) reasons.push(`teaches: ${reel.outcome}`);
    if (fit > 0.8) reasons.push(`pitched at ${reel.difficulty}`);

    // Following a creator is a stated preference, so it earns a real boost —
    // but a bounded one. Large enough to break a tie, too small to drag a weak
    // reel past a strong one and turn the feed into a single channel.
    const followed = follows.has(reel.creator.handle);
    if (followed) reasons.push(`you follow ${reel.creator.handle}`);

    const score =
      similarity * 0.44 +
      tasteFit * 0.2 +
      reel.substance * 0.22 +
      fit * 0.14 +
      (followed ? 0.08 : 0);

    scored.push({
      reel,
      similarity: Number(similarity.toFixed(4)),
      tasteFit: Number(tasteFit.toFixed(4)),
      novelty: 0,
      substance: reel.substance,
      difficultyFit: Number(fit.toFixed(3)),
      score: Number(score.toFixed(4)),
      reasons,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const diversified = await mmr(scored, config.agent.rerankK, config.agent.mmrLambda);

  return {
    candidates: diversified,
    rejected: rejected.sort((a, b) => b.wouldHaveScored - a.wouldHaveScored),
    queries,
    poolSize: recommendableReels().length,
  };
}

/* ---------------------------------------------------------------------------
   Maximal marginal relevance.

   Straight top-k on a topical query returns five reels about the same thing.
   MMR trades a little relevance for the guarantee that the shortlist the
   reranker sees actually contains different options — otherwise "rerank" is
   choosing between synonyms.
--------------------------------------------------------------------------- */

export async function mmr(
  candidates: ScoredCandidate[],
  k: number,
  lambda: number,
): Promise<ScoredCandidate[]> {
  if (candidates.length <= 1) return candidates;

  const vectors = new Map<string, number[]>();
  for (const candidate of candidates.slice(0, 40)) {
    const vec = await vectorFor(candidate.reel.id);
    if (vec) vectors.set(candidate.reel.id, vec);
  }

  const selected: ScoredCandidate[] = [];
  const pool = [...candidates];

  while (selected.length < Math.min(k, candidates.length) && pool.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const vec = vectors.get(candidate.reel.id);

      let maxSim = 0;
      if (vec) {
        for (const chosen of selected) {
          const chosenVec = vectors.get(chosen.reel.id);
          if (chosenVec) maxSim = Math.max(maxSim, cosine(vec, chosenVec));
        }
      }
      // Same-creator picks also count as redundancy, which pure vector distance
      // under-penalises when a creator's reels are stylistically identical.
      const creatorPenalty = selected.some((s) => s.reel.creator.handle === candidate.reel.creator.handle)
        ? 0.08
        : 0;

      const value = lambda * candidate.score - (1 - lambda) * maxSim - creatorPenalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    const [picked] = pool.splice(bestIndex, 1);
    picked.novelty = Number(Math.max(0, 1 - (lambda * picked.score - bestValue) / Math.max(lambda, 0.01)).toFixed(3));
    selected.push(picked);
  }

  return selected;
}
