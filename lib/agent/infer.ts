import { z } from "zod";
import { DOMAINS, MOTIVATIONS, TOPIC_BY_ID } from "@/data/ontology";
import { getReel } from "@/data/reels";
import { chatJson } from "@/lib/llm/client";
import { INFERENCE_SYSTEM, buildInferencePrompt } from "@/lib/llm/prompts";
import type {
  AbstractionRung,
  Confidence,
  EvidenceItem,
  InterestInference,
  Reel,
  TasteProfile,
} from "@/lib/types";
import { difficultyLabel, negativeAffinities, positiveAffinities } from "./taste";
import { primarySignal } from "./signals";

/* ---------------------------------------------------------------------------
   Interest inference.

   Two implementations of the same contract. The LLM one reads nuance the
   ontology cannot encode; the deterministic one walks the ontology and must
   still get the trap right on its own, because a demo that only works when the
   API key is present is not a working demo.
--------------------------------------------------------------------------- */

const rungSchema = z.object({
  level: z.enum(["surface", "domain", "motivation"]),
  label: z.string().min(1),
  rationale: z.string().min(1),
});

const inferenceSchema = z.object({
  surfaceTopics: z.array(z.string()).default([]),
  ladder: z.array(rungSchema).default([]),
  primaryInterest: z.string().min(3),
  secondaryInterests: z.array(z.string()).default([]),
  underlyingMotivation: z.string().default(""),
  careerSignal: z.string().nullable().default(null),
  evidence: z
    .array(z.object({ reelId: z.string(), signal: z.string(), weight: z.number() }))
    .default([]),
  avoid: z.array(z.string()).default([]),
  breadthDetected: z.boolean().default(false),
  confidence: z.enum(["High", "Medium", "Low"]).default("Medium"),
  confidenceScore: z.number().min(0).max(1).default(0.5),
  reasoning: z.string().default(""),
});

export interface InferenceOutcome {
  inference: InterestInference;
  usedLlm: boolean;
  model?: string;
  tokens?: { prompt: number; completion: number };
  ms: number;
  note?: string;
}

/* --- Deterministic path -------------------------------------------------- */

/** Phrasing for a (domain, motivation) pair — the rung-3 vocabulary. */
const INTEREST_PHRASES: Record<string, string> = {
  [`${DOMAINS.SOFTWARE_ENGINEERING}|${MOTIVATIONS.BECOME_EMPLOYABLE}`]:
    "Software engineering as a career path",
  [`${DOMAINS.SOFTWARE_ENGINEERING}|${MOTIVATIONS.UNDERSTAND_DEEPLY}`]:
    "How software actually works underneath",
  [`${DOMAINS.SOFTWARE_ENGINEERING}|${MOTIVATIONS.BUILD_SOMETHING}`]:
    "Shipping real software end to end",
  [`${DOMAINS.SOFTWARE_ENGINEERING}|${MOTIVATIONS.BELONG}`]:
    "Belonging to the developer world, with the skills to back it",
  [`${DOMAINS.SYSTEMS}|${MOTIVATIONS.BECOME_EMPLOYABLE}`]:
    "System design for interviews and real services",
  [`${DOMAINS.SYSTEMS}|${MOTIVATIONS.UNDERSTAND_DEEPLY}`]:
    "How large systems hold together under load",
  [`${DOMAINS.SYSTEMS}|${MOTIVATIONS.BUILD_SOMETHING}`]: "Building and running services that survive",
  [`${DOMAINS.APPLIED_AI}|${MOTIVATIONS.STAY_CURRENT}`]: "Keeping up with applied AI, substantively",
  [`${DOMAINS.APPLIED_AI}|${MOTIVATIONS.UNDERSTAND_DEEPLY}`]: "How modern AI systems actually work",
  [`${DOMAINS.APPLIED_AI}|${MOTIVATIONS.BUILD_SOMETHING}`]: "Building with AI rather than collecting tools",
  [`${DOMAINS.SECURITY}|${MOTIVATIONS.UNDERSTAND_DEEPLY}`]: "How systems get broken, and defended",
  [`${DOMAINS.HARDWARE}|${MOTIVATIONS.BUY_WELL}`]: "Choosing hardware on evidence, not spec sheets",
  [`${DOMAINS.HARDWARE}|${MOTIVATIONS.UNDERSTAND_DEEPLY}`]: "What the machine is doing under your code",
  [`${DOMAINS.CAREER}|${MOTIVATIONS.BECOME_EMPLOYABLE}`]: "Getting hired as a software engineer",
  [`${DOMAINS.CULTURE}|${MOTIVATIONS.BELONG}`]: "Developer culture and the life around the work",
  [`${DOMAINS.CULTURE}|${MOTIVATIONS.STAY_CURRENT}`]: "Staying current with what is shipping",
};

interface Weighted<T> {
  value: T;
  weight: number;
}

function topWeighted<T>(entries: Map<T, number>): Weighted<T> | null {
  let best: Weighted<T> | null = null;
  for (const [value, weight] of entries) {
    if (!best || weight > best.weight) best = { value, weight };
  }
  return best;
}

export function inferDeterministic(currentReel: Reel, profile: TasteProfile): InterestInference {
  const positives = positiveAffinities(profile, 8);
  const negatives = negativeAffinities(profile);

  const domainWeights = new Map<string, number>();
  const motivationWeights = new Map<string, number>();
  const surfaceLabels = new Map<string, number>();
  const categorySet = new Set<string>();

  for (const affinity of positives) {
    const reel = getReel(affinity.reelId);
    if (!reel) continue;
    categorySet.add(reel.category);
    for (const topicId of reel.topics) {
      const node = TOPIC_BY_ID.get(topicId);
      if (!node) continue;
      // Pure-culture topics describe the wrapper, not the interest — a meme
      // about Java is evidence about Java, not evidence about memes.
      const isWrapper = node.domain === DOMAINS.CULTURE;
      domainWeights.set(
        node.domain,
        (domainWeights.get(node.domain) ?? 0) + affinity.score * (isWrapper ? 0.25 : 1),
      );
      motivationWeights.set(
        node.motivation,
        (motivationWeights.get(node.motivation) ?? 0) + affinity.score * (isWrapper ? 0.3 : 1),
      );
      surfaceLabels.set(node.label, (surfaceLabels.get(node.label) ?? 0) + affinity.score);
    }
  }

  const topDomain = topWeighted(domainWeights)?.value ?? DOMAINS.SOFTWARE_ENGINEERING;
  const topMotivation = topWeighted(motivationWeights)?.value ?? MOTIVATIONS.BECOME_EMPLOYABLE;

  const surfaceTopics = [...surfaceLabels.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label]) => label);

  const distinctTopics = new Set(
    positives.flatMap((a) => getReel(a.reelId)?.topics ?? []),
  );
  // Breadth is the trap detector: several distinct topics, or more than one
  // category, means the shared keyword is not the interest.
  const breadthDetected = distinctTopics.size >= 3 || categorySet.size >= 2;

  const primaryInterest =
    INTEREST_PHRASES[`${topDomain}|${topMotivation}`] ?? `${topDomain} — ${topMotivation.toLowerCase()}`;

  const secondaryInterests = [...domainWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(1, 3)
    .map(([domain]) => domain);

  const ladder: AbstractionRung[] = [
    {
      level: "surface",
      label: surfaceTopics.slice(0, 3).join(", ") || currentReel.category,
      rationale: `Taken literally, the watched reels are about ${
        surfaceTopics.slice(0, 3).join(", ") || currentReel.topics.join(", ")
      }.`,
    },
    {
      level: "domain",
      label: topDomain,
      rationale: breadthDetected
        ? `Those topics span ${categorySet.size} categories and ${distinctTopics.size} distinct subjects, so the shared vocabulary is a coincidence — ${topDomain.toLowerCase()} is what actually contains all of them.`
        : `The watched reels sit inside ${topDomain.toLowerCase()}.`,
    },
    {
      level: "motivation",
      label: topMotivation,
      rationale: `Behaviour points at intent rather than curiosity: ${positives
        .slice(0, 2)
        .map((a) => `"${getReel(a.reelId)?.title ?? a.reelId}" was ${primarySignal(a)}`)
        .join(", ")}.`,
    },
  ];

  const evidence: EvidenceItem[] = positives.slice(0, 5).map((affinity) => ({
    reelId: affinity.reelId,
    title: getReel(affinity.reelId)?.title ?? affinity.reelId,
    signal: primarySignal(affinity),
    weight: Number(affinity.score.toFixed(3)),
  }));

  const avoid: string[] = [];
  if (breadthDetected && currentReel.topics.length) {
    const surface = TOPIC_BY_ID.get(currentReel.topics[0])?.label ?? currentReel.category;
    avoid.push(`More ${surface.toLowerCase()} content of the same kind — it would restate what they just watched`);
  }
  avoid.push("Listicles and outcome promises — anything selling a job rather than teaching a skill");
  if (negatives.length) {
    const rejected = negatives
      .map((a) => getReel(a.reelId)?.genre)
      .filter((g, i, arr): g is NonNullable<typeof g> => Boolean(g) && arr.indexOf(g) === i);
    if (rejected.length) avoid.push(`${rejected.join(" and ")} content — actively skipped in this session`);
  }

  const evidenceStrength = Math.min(1, positives.length / 4);
  const confidenceScore = Number(((profile.signalStrength * 0.6 + evidenceStrength * 0.4) || 0.3).toFixed(2));
  const confidence: Confidence =
    confidenceScore >= 0.68 ? "High" : confidenceScore >= 0.38 ? "Medium" : "Low";

  return {
    surfaceTopics,
    ladder,
    primaryInterest,
    secondaryInterests,
    underlyingMotivation: topMotivation,
    careerSignal:
      topMotivation === MOTIVATIONS.BECOME_EMPLOYABLE
        ? "Preparing for a software engineering role"
        : null,
    evidence,
    avoid,
    confidence,
    confidenceScore,
    breadthDetected,
  };
}

/* --- LLM path ------------------------------------------------------------ */

export async function inferInterest(
  currentReel: Reel,
  profile: TasteProfile,
): Promise<InferenceOutcome> {
  const started = Date.now();
  const deterministic = inferDeterministic(currentReel, profile);

  const result = await chatJson<z.infer<typeof inferenceSchema>>(
    [
      { role: "system", content: INFERENCE_SYSTEM },
      { role: "user", content: buildInferencePrompt({ currentReel, profile }) },
    ],
    { temperature: 0.2, maxTokens: 1600 },
  );

  if (!result) {
    return {
      inference: deterministic,
      usedLlm: false,
      ms: Date.now() - started,
      note: "Omega C unavailable — inference from the ontology walk instead.",
    };
  }

  const parsed = inferenceSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      inference: deterministic,
      usedLlm: false,
      ms: Date.now() - started,
      note: `Model output failed validation (${parsed.error.issues[0]?.message ?? "shape"}) — used the ontology walk.`,
    };
  }

  const data = parsed.data;

  // Evidence is re-grounded against real reels: the model may cite a title
  // rather than an id, and a citation that does not resolve is worse than none.
  const evidence: EvidenceItem[] = data.evidence
    .map((item) => {
      const reel = getReel(item.reelId);
      if (!reel) return null;
      const affinity = profile.affinities.find((a) => a.reelId === item.reelId);
      return {
        reelId: item.reelId,
        title: reel.title,
        signal: affinity ? primarySignal(affinity) : item.signal,
        weight: affinity ? Number(affinity.score.toFixed(3)) : item.weight,
      };
    })
    .filter((x): x is EvidenceItem => x !== null);

  // The guardrail is not the model's to relax: if the ontology saw breadth, the
  // avoid list keeps its anti-repetition entry regardless of what came back.
  const avoid = [...new Set([...data.avoid, ...(deterministic.breadthDetected ? deterministic.avoid.slice(0, 1) : [])])];

  const inference: InterestInference = {
    surfaceTopics: data.surfaceTopics.length ? data.surfaceTopics : deterministic.surfaceTopics,
    ladder: data.ladder.length >= 2 ? data.ladder : deterministic.ladder,
    primaryInterest: data.primaryInterest,
    secondaryInterests: data.secondaryInterests,
    underlyingMotivation: data.underlyingMotivation || deterministic.underlyingMotivation,
    careerSignal: data.careerSignal,
    evidence: evidence.length ? evidence : deterministic.evidence,
    avoid: avoid.length ? avoid : deterministic.avoid,
    // Confidence is capped by how much evidence actually exists, so the model
    // cannot talk itself into certainty the behaviour does not support.
    confidence: capConfidence(data.confidence, profile.signalStrength),
    confidenceScore: Math.min(data.confidenceScore, 0.35 + profile.signalStrength * 0.65),
    breadthDetected: data.breadthDetected || deterministic.breadthDetected,
  };

  return {
    inference,
    usedLlm: true,
    model: result.model,
    tokens: result.tokens,
    ms: Date.now() - started,
  };
}

function capConfidence(claimed: Confidence, signalStrength: number): Confidence {
  if (signalStrength < 0.25) return "Low";
  if (signalStrength < 0.55 && claimed === "High") return "Medium";
  return claimed;
}

export { difficultyLabel };
