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

function rejection(
  reel: Reel,
  reason: RejectedCandidate["reason"],
  detail: string,
  similarity: number,
): RejectedCandidate {
  return {
    reelId: reel.id,
    title: reel.title,
    reason,
    detail,
    wouldHaveScored: Number(similarity.toFixed(3)),
  };
}

function mutedTopicHit(reel: Reel, mutedTopics: Set<string>): string[] {
  const mutedHit = reel.topics.filter((t) => mutedTopics.has(t));
  const majority = mutedHit.length >= Math.ceil(reel.topics.length / 2);
  return mutedHit.length && majority ? mutedHit : [];
}

function sameSubtopicOverlap(reel: Reel, currentSubtopics: Set<string>): string[] | null {
  const overlap = reel.topics.filter((t) => currentSubtopics.has(t));
  const onlyOverlap = overlap.length > 0 && reel.topics.every((t) => currentSubtopics.has(t));
  return onlyOverlap ? overlap : null;
}

function hardReject(
  reel: Reel,
  similarity: number,
  ctx: {
    exclude: Set<string>;
    dislikes: Set<string>;
    mutedTopics: Set<string>;
    currentSubtopics: Set<string>;
    breadthDetected: boolean;
    difficultyBias: number;
  },
): RejectedCandidate | null {
  if (ctx.exclude.has(reel.id)) {
    return rejection(reel, "already-seen", "Already watched in this session.", similarity);
  }
  if (ctx.dislikes.has(reel.id)) {
    return rejection(reel, "off-interest", "You marked this reel as not interesting.", similarity);
  }
  const mutedHit = mutedTopicHit(reel, ctx.mutedTopics);
  if (mutedHit.length) {
    return rejection(
      reel,
      "off-interest",
      `Muted after you disliked similar content (${mutedHit.join(", ")}).`,
      similarity,
    );
  }
  const hype = judgeReel(reel);
  if (hype.blocked) {
    const detail = hype.matched.length
      ? `Promises an outcome instead of teaching one — "${hype.matched[0]}" (${hype.kinds.join(", ")}).`
      : `Reads as hype (${hype.kinds.join(", ")}).`;
    return rejection(reel, "hype", detail, similarity);
  }
  if (reel.substance < config.agent.substanceFloor) {
    return rejection(
      reel,
      "low-substance",
      `Nothing transferable in it — substance ${reel.substance.toFixed(2)}, below the ${config.agent.substanceFloor} floor.`,
      similarity,
    );
  }
  const overlap = sameSubtopicOverlap(reel, ctx.currentSubtopics);
  if (ctx.breadthDetected && overlap && reel.substance < 0.8) {
    return rejection(
      reel,
      "same-subtopic",
      `Only connection is "${overlap.join(", ")}" — the same narrow topic they just watched, while their history is broader.`,
      similarity,
    );
  }
  const fit = difficultyFit(reel, ctx.difficultyBias);
  if (fit < 0.2) {
    return rejection(
      reel,
      "difficulty-mismatch",
      `${reel.difficulty} content for a ${difficultyLabel(ctx.difficultyBias).toLowerCase()}-level viewer.`,
      similarity,
    );
  }
  return null;
}

async function scoreCandidate(
  reel: Reel,
  similarity: number,
  query: string,
  profile: TasteProfile,
  follows: Set<string>,
): Promise<ScoredCandidate> {
  const tasteFit = profile.vector.length
    ? Math.max(0, cosine(profile.vector, (await vectorFor(reel.id)) ?? []))
    : 0;
  const fit = difficultyFit(reel, profile.difficultyBias);
  const followed = follows.has(reel.creator.handle);
  const reasons: string[] = [];
  if (similarity > 0.5) reasons.push(`close match to "${query}"`);
  if (reel.outcome) reasons.push(`teaches: ${reel.outcome}`);
  if (fit > 0.8) reasons.push(`pitched at ${reel.difficulty}`);
  if (followed) reasons.push(`you follow ${reel.creator.handle}`);

  const score =
    similarity * 0.44 + tasteFit * 0.2 + reel.substance * 0.22 + fit * 0.14 + (followed ? 0.08 : 0);

  return {
    reel,
    similarity: Number(similarity.toFixed(4)),
    tasteFit: Number(tasteFit.toFixed(4)),
    novelty: 0,
    substance: reel.substance,
    difficultyFit: Number(fit.toFixed(3)),
    score: Number(score.toFixed(4)),
    reasons,
  };
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
  const guard = {
    exclude,
    dislikes,
    mutedTopics,
    currentSubtopics,
    breadthDetected: inference.breadthDetected,
    difficultyBias: profile.difficultyBias,
  };

  for (const [reelId, { score: similarity, query }] of best) {
    const reel = getReel(reelId);
    if (!reel) continue;
    const blocked = hardReject(reel, similarity, guard);
    if (blocked) {
      rejected.push(blocked);
      continue;
    }
    scored.push(await scoreCandidate(reel, similarity, query, profile, follows));
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
