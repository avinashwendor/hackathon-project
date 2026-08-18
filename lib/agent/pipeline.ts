import { getReel } from "@/data/reels";
import type { SocialState } from "@/lib/store";
import { getProvider } from "@/lib/embeddings";
import { activeLlm, llmConfigured } from "@/lib/llm/client";
import { indexInfo } from "@/lib/vector";
import type {
  AgentDiagnostics,
  AgentResult,
  AgentStage,
  Confidence,
  InteractionEvent,
  InterestInference,
  RecommendationCard,
  Reel,
  RejectedCandidate,
} from "@/lib/types";
import { formatCard } from "./format";
import { inferInterest } from "./infer";
import { rerank, type RerankOutcome } from "./rerank";
import { retrieve } from "./retrieve";
import { buildTasteProfile, difficultyLabel } from "./taste";

const CONFIDENCE_RANK: Record<Confidence, number> = { Low: 0, Medium: 1, High: 2 };

/**
 * A recommendation cannot be more certain than the interest read it rests on.
 * The reranker only sees a shortlist, so it has no way to know the history was
 * four events with no likes — this is where that gets enforced.
 */
function capConfidenceBy(claimed: Confidence, ceiling: Confidence): Confidence {
  return CONFIDENCE_RANK[claimed] <= CONFIDENCE_RANK[ceiling] ? claimed : ceiling;
}

function uniqueRejected(rows: RejectedCandidate[]): RejectedCandidate[] {
  return rows.filter((rejection, i, arr) => arr.findIndex((r) => r.reelId === rejection.reelId) === i);
}

function composeCard(
  currentReel: Reel,
  inference: InterestInference,
  ranked: RerankOutcome,
): RecommendationCard {
  const whyEvidence = inference.evidence.length
    ? inference.evidence
        .slice(0, 3)
        .map((e) => `${e.signal} "${e.title}"`)
        .join("; ")
    : "single reel in view, no prior session history";
  const domainRationale =
    inference.ladder.find((r) => r.level === "domain")?.rationale ?? inference.underlyingMotivation;

  return {
    currentReel: `${currentReel.title} (${currentReel.creator.handle}, ${currentReel.category})`,
    interestDetected: inference.primaryInterest,
    why: `${whyEvidence}. ${domainRationale}`,
    recommendedTechReel: ranked.pick.reel.title,
    category: ranked.pick.reel.category,
    whyThisRecommendation: ranked.whyThisRecommendation,
    difficulty: ranked.difficulty,
    confidence: capConfidenceBy(ranked.confidence, inference.confidence),
  };
}

/* ---------------------------------------------------------------------------
   The agent loop.

   signals → taste → inference → retrieval → guardrails → rerank → card

   Every stage records what it did and how long it took, because the trace is
   half the product: a recommendation a student cannot interrogate is just
   another black-box feed, which is the thing this is meant to be an answer to.
--------------------------------------------------------------------------- */

export interface RecommendInput {
  sessionId: string;
  currentReelId: string;
  events: InteractionEvent[];
  /** Ids already recommended in this session, so the agent does not repeat itself. */
  exclude?: string[];
  /** Follows, dislikes and muted topics for this viewer. */
  social?: SocialState;
  /**
   * Called as each stage starts and finishes. The console streams these over
   * SSE so a ten-second reasoning step shows its progress instead of a spinner.
   */
  onStage?: (stage: AgentStage) => void;
}

class StageRecorder {
  private stages: AgentStage[] = [];
  private startedAt = Date.now();

  constructor(private readonly onStage?: (stage: AgentStage) => void) {}

  begin(key: string, label: string): number {
    const stage: AgentStage = { key, label, detail: "", status: "running", ms: 0 };
    this.stages.push(stage);
    this.onStage?.(stage);
    return Date.now();
  }

  end(key: string, since: number, detail: string, metrics?: Record<string, string | number>) {
    const stage = this.stages.find((s) => s.key === key);
    if (!stage) return;
    stage.status = "done";
    stage.detail = detail;
    stage.ms = Date.now() - since;
    stage.metrics = metrics;
    this.onStage?.(stage);
  }

  fail(key: string, since: number, detail: string) {
    const stage = this.stages.find((s) => s.key === key);
    if (!stage) return;
    stage.status = "failed";
    stage.detail = detail;
    stage.ms = Date.now() - since;
  }

  skip(key: string, label: string, detail: string) {
    this.stages.push({ key, label, detail, status: "skipped", ms: 0 });
  }

  all(): AgentStage[] {
    return this.stages;
  }

  elapsed(): number {
    return Date.now() - this.startedAt;
  }
}

export async function recommend(input: RecommendInput): Promise<AgentResult> {
  const currentReel = getReel(input.currentReelId);
  if (!currentReel) throw new Error(`Unknown reel: ${input.currentReelId}`);

  const stages = new StageRecorder(input.onStage);
  let llmUsed = false;
  let llmModel = activeLlm().model;
  const tokens = { prompt: 0, completion: 0 };
  const notes: string[] = [];

  // 1 — index -------------------------------------------------------------
  let t = stages.begin("index", "Vector index");
  const index = await indexInfo();
  stages.end("index", t, `${index.count} reels in ${index.store}`, {
    provider: index.provider,
    dims: index.dims,
    warm: index.cached ? "cached" : "built",
  });
  if (index.fallbackReason) notes.push(index.fallbackReason);

  // 2 — signals -----------------------------------------------------------
  t = stages.begin("signals", "Read the behaviour");
  const profile = await buildTasteProfile({ sessionId: input.sessionId, events: input.events });
  const positives = profile.affinities.filter((a) => a.score > 0.1).length;
  const negatives = profile.affinities.filter((a) => a.score < -0.05).length;
  stages.end(
    "signals",
    t,
    `${input.events.length} events over ${profile.affinities.length} reels — ${positives} positive, ${negatives} negative`,
    {
      "signal strength": `${Math.round(profile.signalStrength * 100)}%`,
      "level read": difficultyLabel(profile.difficultyBias),
    },
  );

  // 3 — inference ---------------------------------------------------------
  t = stages.begin("infer", "Infer the interest");
  const inferred = await inferInterest(currentReel, profile);
  llmUsed = llmUsed || inferred.usedLlm;
  if (inferred.model) llmModel = inferred.model;
  if (inferred.tokens) {
    tokens.prompt += inferred.tokens.prompt;
    tokens.completion += inferred.tokens.completion;
  }
  if (inferred.note) notes.push(inferred.note);
  stages.end(
    "infer",
    t,
    inferred.usedLlm
      ? `Climbed to "${inferred.inference.primaryInterest}" via ${llmModel}`
      : `Climbed to "${inferred.inference.primaryInterest}" from the ontology walk`,
    {
      breadth: inferred.inference.breadthDetected ? "detected" : "narrow",
      confidence: inferred.inference.confidence,
      evidence: inferred.inference.evidence.length,
    },
  );

  // 4 — retrieval + guardrails -------------------------------------------
  t = stages.begin("retrieve", "Search and filter");
  const retrieval = await retrieve({
    currentReel,
    profile,
    inference: inferred.inference,
    exclude: input.exclude,
    social: input.social,
  });
  const hypeBlocked = retrieval.rejected.filter((r) => r.reason === "hype").length;
  const sameTopic = retrieval.rejected.filter((r) => r.reason === "same-subtopic").length;
  const suppressed = retrieval.rejected.filter((r) => r.reason === "off-interest").length;
  stages.end(
    "retrieve",
    t,
    `${retrieval.queries.length} queries → ${retrieval.candidates.length} candidates, ${retrieval.rejected.length} refused`,
    {
      "hype blocked": hypeBlocked,
      "same-topic blocked": sameTopic,
      ...(suppressed ? { "you suppressed": suppressed } : {}),
      ...(input.social?.follows.length ? { following: input.social.follows.length } : {}),
      pool: retrieval.poolSize,
    },
  );

  if (!retrieval.candidates.length) {
    throw new Error("Every candidate was filtered out — the catalog has nothing safe to serve here.");
  }

  // 5 — rerank ------------------------------------------------------------
  t = stages.begin("rerank", "Judge what is worth 60 seconds");
  const ranked = await rerank({
    currentReel,
    candidates: retrieval.candidates,
    inference: inferred.inference,
    profile,
  });
  llmUsed = llmUsed || ranked.usedLlm;
  if (ranked.model) llmModel = ranked.model;
  if (ranked.tokens) {
    tokens.prompt += ranked.tokens.prompt;
    tokens.completion += ranked.tokens.completion;
  }
  if (ranked.note) notes.push(ranked.note);
  stages.end(
    "rerank",
    t,
    ranked.usedLlm
      ? `${llmModel} chose "${ranked.pick.reel.title}" from ${retrieval.candidates.length}`
      : `Retrieval score chose "${ranked.pick.reel.title}"`,
    {
      score: ranked.pick.score.toFixed(3),
      substance: ranked.pick.reel.substance.toFixed(2),
      "also rejected": ranked.extraRejections.length,
    },
  );

  // 6 — output ------------------------------------------------------------
  t = stages.begin("compose", "Compose the answer");
  const inference = inferred.inference;
  const card = composeCard(currentReel, inference, ranked);
  stages.end("compose", t, "Eight-field card rendered", {
    fields: 8,
    confidence: card.confidence,
    ...(card.confidence !== ranked.confidence
      ? { capped: `${ranked.confidence} → ${card.confidence} (thin evidence)` }
      : {}),
  });

  const allRejected = uniqueRejected([...retrieval.rejected, ...ranked.extraRejections]);

  const diagnostics: AgentDiagnostics = {
    llmModel: llmUsed ? llmModel : "none",
    llmUsed,
    embeddingProvider: index.provider,
    embeddingDims: index.dims,
    vectorStore: index.store,
    candidatesRetrieved: retrieval.candidates.length,
    candidatesRejected: allRejected.length,
    totalMs: stages.elapsed(),
    tokens: llmUsed ? tokens : undefined,
    degraded: notes.length ? notes.join(" ") : undefined,
  };

  return {
    card,
    formatted: formatCard(card),
    inference,
    recommendation: ranked.pick.reel,
    runnersUp: ranked.runnersUp,
    rejected: allRejected,
    stages: stages.all(),
    diagnostics,
    profile,
  };
}

/** Whether the deployment is running with real providers or in demo fallback. */
export async function agentHealth() {
  const index = await indexInfo().catch(() => null);
  const llm = activeLlm();
  return {
    llm: llmConfigured(),
    llmProvider: llm.provider,
    llmModel: llm.model,
    embeddings: getProvider().name,
    vector: index?.store ?? "not built",
    indexed: index?.count ?? 0,
    dims: index?.dims ?? 0,
    fallback: index?.fallbackReason,
  };
}
