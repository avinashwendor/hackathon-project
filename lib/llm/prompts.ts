import type { Reel, ReelAffinity, TasteProfile } from "@/lib/types";
import { TOPIC_BY_ID } from "@/data/ontology";
import { getReel } from "@/data/reels";

/* ---------------------------------------------------------------------------
   Prompts.

   Kept in one file so the reasoning contract is readable in one sitting. Two
   rules do the heavy lifting and both are stated as prohibitions, because
   models comply with prohibitions far more reliably than with encouragement:

   • Never answer with the surface topic when the history shows a pattern.
   • Never recommend a reel that promises an outcome instead of teaching a skill.
--------------------------------------------------------------------------- */

export const INFERENCE_SYSTEM = `You are the inference core of Upstream, a recommendation agent for students who scroll short-form video.

Your job is to read a student's viewing behaviour and name the interest that explains it — the one that sits underneath the individual reels.

HOW TO THINK

Climb three rungs, in order:
  1. SURFACE — what the reels literally are ("a Java meme", "a laptop comparison").
  2. DOMAIN — the field that contains all of them ("software engineering craft").
  3. MOTIVATION — why a person watches that field right now ("orienting toward a first engineering job").

The single most common failure in this task is stopping at rung 1. If four reels share one keyword and nothing else, the keyword is a coincidence of vocabulary, not an interest. Look for what the reels have in common that is NOT a word they share.

Weight behaviour, not topics. A saved reel and a re-watched reel are strong evidence. A reel skipped in the first two seconds is evidence AGAINST that direction and you must treat it that way. A reel watched all the way through with no interaction still counts — completion is the most honest signal in short-form.

Pay attention to the outlier. When three reels fit a pattern and one does not, the outlier usually reveals the real motivation. A student watching engineering memes AND a laptop comparison is not interested in memes and hardware separately — they are equipping themselves for something.

CALIBRATION
  High   — three or more consistent strong signals pointing at one domain.
  Medium — a clear direction but thin evidence, or two competing readings.
  Low    — mostly skips, one or two weak signals, or genuinely mixed intent.
Never claim High confidence from a single reel. State the honest level.

WHAT TO AVOID
Populate "avoid" with the specific recommendations that would be lazy or hollow for THIS student. Two categories always belong there when relevant:
  • More of the exact surface topic, when the history shows a broader pattern.
  • Hype content — reels promising an outcome ("will get you a job", "replace your degree", "N tools you need") rather than teaching a skill. High engagement on hype means the student is anxious about their career, not that they want more hype.`;

export interface InferenceContext {
  currentReel: Reel;
  profile: TasteProfile;
}

function describeReel(reel: Reel, affinity?: ReelAffinity): string {
  const lines = [
    `- "${reel.title}" by ${reel.creator.handle}`,
    `  category: ${reel.category} | topics: ${reel.topics.join(", ") || "none"} | ${reel.durationSec}s`,
    `  caption: ${reel.caption}`,
    `  transcript: ${reel.transcript.slice(0, 420)}`,
  ];
  if (affinity) {
    lines.push(
      `  BEHAVIOUR: ${affinity.basis.join("; ")} → signal ${affinity.score >= 0 ? "+" : ""}${affinity.score.toFixed(2)}`,
    );
  }
  return lines.join("\n");
}

export function buildInferencePrompt({ currentReel, profile }: InferenceContext): string {
  const affinityById = new Map(profile.affinities.map((a) => [a.reelId, a]));

  const historyBlocks = profile.affinities
    .map((affinity) => {
      const reel = getReel(affinity.reelId);
      return reel ? describeReel(reel, affinity) : null;
    })
    .filter(Boolean)
    .join("\n\n");

  const facetLines = profile.facets
    .slice(0, 10)
    .map((facet) => {
      const node = TOPIC_BY_ID.get(facet.topic);
      return `  ${facet.topic}${node ? ` (${node.domain} → ${node.motivation})` : ""}: ${facet.weight.toFixed(2)}`;
    })
    .join("\n");

  return `CURRENT REEL (what they are watching right now)
${describeReel(currentReel, affinityById.get(currentReel.id))}

VIEWING HISTORY (most recent first, with measured behaviour)
${historyBlocks || "  (no prior history in this session)"}

ROLLED-UP TOPIC WEIGHTS (computed from behaviour, already time-decayed)
${facetLines || "  (none)"}

SIGNAL STRENGTH: ${(profile.signalStrength * 100).toFixed(0)}% — ${
    profile.signalStrength > 0.66
      ? "solid evidence"
      : profile.signalStrength > 0.33
        ? "moderate evidence, be careful"
        : "thin evidence, stay humble"
  }
DIFFICULTY LEAN: ${profile.difficultyBias.toFixed(2)} (0 = beginner, 1 = advanced)

Return this exact JSON shape:
{
  "surfaceTopics": ["what the reels literally are, 2-5 items"],
  "ladder": [
    {"level": "surface", "label": "...", "rationale": "one sentence"},
    {"level": "domain",  "label": "...", "rationale": "what connects them that is not a shared word"},
    {"level": "motivation", "label": "...", "rationale": "why a student watches this set right now"}
  ],
  "primaryInterest": "a specific interest, 3-8 words, NOT a single keyword",
  "secondaryInterests": ["1-3 adjacent interests"],
  "underlyingMotivation": "one sentence on what they are actually trying to do",
  "careerSignal": "where they appear to be heading, or null if the evidence does not support a read",
  "evidence": [
    {"reelId": "id from the history", "signal": "the behaviour that counted", "weight": 0.0}
  ],
  "avoid": ["specific things that would be a lazy or hollow recommendation for this student"],
  "breadthDetected": true,
  "confidence": "High" | "Medium" | "Low",
  "confidenceScore": 0.0,
  "reasoning": "2-3 sentences a student would find fair if they read it"
}`;
}

/* --- Reranking ----------------------------------------------------------- */

export const RERANK_SYSTEM = `You are the ranking stage of Upstream. Vector retrieval has already produced a shortlist that is topically close to the student's inferred interest. Closeness is solved. Your job is the judgement retrieval cannot make: which of these reels is actually worth a student's next 60 seconds.

Rank by, in order of importance:
  1. SERVES THE INFERRED INTEREST — the interest as stated, not the keywords in it. A reel that advances the student's real direction beats one that merely shares vocabulary with their last watch.
  2. TEACHES A CAPABILITY — after watching, the student can do or explain something they could not before. Prefer a stated, checkable outcome over a promised one.
  3. REACHABLE — matched to their level. An Advanced reel served to a beginner is a bounce; a Beginner reel served to someone already past it is a waste.
  4. ADDS SOMETHING NEW — not a restatement of a reel they already watched.

HARD RULES
  • Never rank a reel that promises an outcome ("will get you a job", "replace your degree", "N tools you need", "secret roadmap") above one that teaches a skill. If the shortlist contains such a reel, reject it explicitly and say which phrase gave it away.
  • Never pick a reel whose only connection is a shared keyword with the current reel.
  • If the student's history is broad, prefer the reel that serves the breadth over the one that narrows them back down.

You must also write the student-facing explanation. It should be specific enough that the student recognises their own behaviour in it, and honest enough that they would not feel manipulated by it.`;

export interface RerankCandidate {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  topics: string[];
  outcome: string;
  caption: string;
  transcript: string;
  substance: number;
  hypeScore: number;
  hypeMatched: string[];
  retrievalScore: number;
}

export function buildRerankPrompt(args: {
  currentReel: Reel;
  interest: string;
  motivation: string;
  avoid: string[];
  difficultyLean: string;
  candidates: RerankCandidate[];
}): string {
  const candidateBlocks = args.candidates
    .map(
      (c, i) =>
        `[${i + 1}] id=${c.id}
  title: ${c.title}
  category: ${c.category} | difficulty: ${c.difficulty} | topics: ${c.topics.join(", ")}
  teaches: ${c.outcome || "(nothing stated)"}
  caption: ${c.caption}
  transcript: ${c.transcript.slice(0, 300)}
  substance: ${c.substance.toFixed(2)} | hype: ${c.hypeScore.toFixed(2)}${
    c.hypeMatched.length ? ` (${c.hypeMatched.slice(0, 2).join(" / ")})` : ""
  } | retrieval: ${c.retrievalScore.toFixed(3)}`,
    )
    .join("\n\n");

  return `STUDENT
  inferred interest: ${args.interest}
  underlying motivation: ${args.motivation}
  level: ${args.difficultyLean}
  must not be served: ${args.avoid.join("; ") || "(nothing specified)"}

CURRENTLY WATCHING
  "${args.currentReel.title}" — ${args.currentReel.category}, topics: ${args.currentReel.topics.join(", ")}

SHORTLIST
${candidateBlocks}

Return this exact JSON shape:
{
  "pickId": "the id of the single best reel",
  "whyThisRecommendation": "2-3 sentences connecting THIS reel to what the student actually wants. Name the specific behaviour that justifies it. Never use the words 'algorithm' or 'engagement'.",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "confidence": "High" | "Medium" | "Low",
  "runnersUp": ["ids, best first, up to 3"],
  "rejected": [
    {"id": "...", "reason": "hype" | "low-substance" | "same-subtopic" | "difficulty-mismatch" | "off-interest", "detail": "one specific sentence, quoting the phrase if it is hype"}
  ]
}`;
}
