import { z } from "zod";
import { getReel } from "@/data/reels";
import { chatJson } from "@/lib/llm/client";
import { RERANK_SYSTEM, buildRerankPrompt, type RerankCandidate } from "@/lib/llm/prompts";
import type {
  Confidence,
  Difficulty,
  InterestInference,
  Reel,
  RejectedCandidate,
  RejectionReason,
  ScoredCandidate,
  TasteProfile,
} from "@/lib/types";
import { judgeReel } from "./hype";
import { difficultyLabel } from "./taste";

/* ---------------------------------------------------------------------------
   Reranking.

   Retrieval answers "what is close". This stage answers "what is worth their
   next sixty seconds", which is a judgement about value, not distance — the
   one part of the pipeline where a language model genuinely outperforms the
   maths.

   The model chooses, but it does not get to overrule the guardrails: its pick
   is re-checked against the hype filter afterwards. A model that argues itself
   into recommending a listicle loses that argument here.
--------------------------------------------------------------------------- */

const rerankSchema = z.object({
  pickId: z.string(),
  whyThisRecommendation: z.string().min(10),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  confidence: z.enum(["High", "Medium", "Low"]),
  runnersUp: z.array(z.string()).default([]),
  rejected: z
    .array(z.object({ id: z.string(), reason: z.string(), detail: z.string() }))
    .default([]),
});

export interface RerankOutcome {
  pick: ScoredCandidate;
  whyThisRecommendation: string;
  difficulty: Difficulty;
  confidence: Confidence;
  runnersUp: ScoredCandidate[];
  extraRejections: RejectedCandidate[];
  usedLlm: boolean;
  model?: string;
  tokens?: { prompt: number; completion: number };
  ms: number;
  note?: string;
}

const VALID_REASONS: RejectionReason[] = [
  "hype",
  "low-substance",
  "same-subtopic",
  "already-seen",
  "difficulty-mismatch",
  "off-interest",
  "duplicate-creator",
];

function toRerankCandidate(candidate: ScoredCandidate): RerankCandidate {
  const hype = judgeReel(candidate.reel);
  return {
    id: candidate.reel.id,
    title: candidate.reel.title,
    category: candidate.reel.category,
    difficulty: candidate.reel.difficulty,
    topics: candidate.reel.topics,
    outcome: candidate.reel.outcome,
    caption: candidate.reel.caption,
    transcript: candidate.reel.transcript,
    substance: candidate.reel.substance,
    hypeScore: hype.score,
    hypeMatched: hype.matched,
    retrievalScore: candidate.score,
  };
}

/** The explanation written without a model — specific, not generic. */
function deterministicWhy(pick: Reel, inference: InterestInference): string {
  const evidence = inference.evidence[0];
  const behaviour = evidence ? `You ${evidence.signal} "${evidence.title}"` : "Your session";
  const lift = inference.breadthDetected
    ? `Rather than serving more of the same, this moves sideways into ${pick.category} — still inside ${inference.primaryInterest.toLowerCase()}, but it adds something.`
    : `It sits squarely inside ${inference.primaryInterest.toLowerCase()}.`;
  const outcome = pick.outcome
    ? ` After it you can ${pick.outcome.charAt(0).toLowerCase()}${pick.outcome.slice(1).replace(/\.$/, "")}.`
    : "";
  return `${behaviour}, which reads as ${inference.underlyingMotivation.toLowerCase()}. ${lift}${outcome} Pitched at ${pick.difficulty}, matching where your attention actually holds.`;
}

export async function rerank(args: {
  currentReel: Reel;
  candidates: ScoredCandidate[];
  inference: InterestInference;
  profile: TasteProfile;
}): Promise<RerankOutcome> {
  const started = Date.now();
  const { candidates, inference, profile, currentReel } = args;

  if (!candidates.length) {
    throw new Error("Reranking called with no candidates");
  }

  const fallback = (note?: string): RerankOutcome => {
    const pick = candidates[0];
    return {
      pick,
      whyThisRecommendation: deterministicWhy(pick.reel, inference),
      difficulty: pick.reel.difficulty,
      confidence: inference.confidence,
      runnersUp: candidates.slice(1, 4),
      extraRejections: [],
      usedLlm: false,
      ms: Date.now() - started,
      note,
    };
  };

  const result = await chatJson<z.infer<typeof rerankSchema>>(
    [
      { role: "system", content: RERANK_SYSTEM },
      {
        role: "user",
        content: buildRerankPrompt({
          currentReel,
          interest: inference.primaryInterest,
          motivation: inference.underlyingMotivation,
          avoid: inference.avoid,
          difficultyLean: difficultyLabel(profile.difficultyBias),
          candidates: candidates.map(toRerankCandidate),
        }),
      },
    ],
    { temperature: 0.3, maxTokens: 1200 },
  );

  if (!result) return fallback("Omega C unavailable — ranked by the retrieval score.");

  const parsed = rerankSchema.safeParse(result.data);
  if (!parsed.success) return fallback("Reranker output failed validation — ranked by the retrieval score.");

  const data = parsed.data;
  const picked = candidates.find((c) => c.reel.id === data.pickId);
  if (!picked) return fallback("Reranker chose an id outside the shortlist — ranked by the retrieval score.");

  // Final guardrail pass. The model does not get the last word on hype.
  const hype = judgeReel(picked.reel);
  if (hype.blocked) {
    const safe = candidates.find((c) => !judgeReel(c.reel).blocked);
    if (safe) {
      return {
        ...fallback(`Reranker picked a reel the hype filter blocks ("${hype.matched[0] ?? hype.kinds[0]}") — overridden.`),
        pick: safe,
        whyThisRecommendation: deterministicWhy(safe.reel, inference),
      };
    }
  }

  const runnersUp = data.runnersUp
    .map((id) => candidates.find((c) => c.reel.id === id))
    .filter((c): c is ScoredCandidate => Boolean(c) && c!.reel.id !== picked.reel.id)
    .slice(0, 3);

  const extraRejections: RejectedCandidate[] = data.rejected
    .map((item) => {
      const reel = getReel(item.id);
      if (!reel) return null;
      const reason = (VALID_REASONS as string[]).includes(item.reason)
        ? (item.reason as RejectionReason)
        : "off-interest";
      const candidate = candidates.find((c) => c.reel.id === item.id);
      return {
        reelId: item.id,
        title: reel.title,
        reason,
        detail: item.detail,
        wouldHaveScored: candidate?.score ?? 0,
      };
    })
    .filter((x): x is RejectedCandidate => x !== null);

  return {
    pick: picked,
    whyThisRecommendation: data.whyThisRecommendation,
    difficulty: picked.reel.difficulty,
    confidence: data.confidence,
    runnersUp: runnersUp.length ? runnersUp : candidates.filter((c) => c !== picked).slice(0, 3),
    extraRejections,
    usedLlm: true,
    model: result.model,
    tokens: result.tokens,
    ms: Date.now() - started,
  };
}
