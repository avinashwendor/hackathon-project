/* ---------------------------------------------------------------------------
   Upstream domain model.

   One rule runs through this file: a reel is never reduced to its keywords.
   Every catalog entry carries the things a shallow recommender throws away —
   what it actually teaches (`outcome`), what it assumes you know
   (`prerequisites`), how much of it is substance versus performance
   (`substance`), and the exact phrases that make it read as hype
   (`hypeMarkers`). The agent's quality ceiling is set here, not in the prompt.
--------------------------------------------------------------------------- */

export const CATEGORIES = [
  "AI",
  "DSA",
  "Java",
  "HLD",
  "Cybersecurity",
  "Cloud",
  "Hardware",
  "Career",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CONFIDENCE_LEVELS = ["High", "Medium", "Low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** `feed` reels are what a student already scrolls; `catalog` is what we can serve back. */
export type ReelLane = "feed" | "catalog" | "both";

/** Coarse genre of a feed reel, used for the seeded sample inputs. */
export type Genre =
  | "entertainment"
  | "gaming"
  | "coding"
  | "ai"
  | "gadgets"
  | "career"
  | "meme"
  | "news";

export interface Creator {
  handle: string;
  name: string;
  /** Hue anchor (0–360) for the generated poster and avatar, so a creator looks consistent. */
  hue: number;
  verified?: boolean;
}

export interface ReelMedia {
  /** Two hues + an angle define the generated poster when no video file exists. */
  poster: { from: number; to: number; angle: number };
  /** HLS master playlist (adaptive). Preferred when present. */
  hlsUrl?: string;
  /** Progressive fallback for browsers without MSE. */
  mp4Url?: string;
  /** Object key in the media bucket, when the file came through the studio pipeline. */
  storageKey?: string;
  /** Renditions present in the ladder, highest first. Filled by the transcoder. */
  renditions?: { height: number; bitrateKbps: number }[];
  /** Path inside the ingest agent's output tree, used by the dev media route. */
  localFile?: string;
}

/** Provenance for reels ingested from the pipeline, kept for attribution. */
export interface ReelSource {
  platform: string;
  url: string | null;
  owner: string | null;
  attribution: string;
  width: number | null;
  height: number | null;
  codec: string | null;
  niches: string[];
  languages: string[];
}

export interface Reel {
  id: string;
  title: string;
  creator: Creator;
  durationSec: number;
  /** The on-screen caption, as a student would read it. */
  caption: string;
  /** Spoken content. This is the text embeddings actually read. */
  transcript: string;
  hashtags: string[];
  category: Category;
  /** Fine-grained topics: "jvm", "garbage-collection", "system-design". */
  topics: string[];
  difficulty: Difficulty;
  lane: ReelLane;
  genre: Genre;
  /** 0–1. How much concrete, transferable technical content it carries. */
  substance: number;
  /** Phrases that make a reel read as hype. Non-empty means the guardrail sees it. */
  hypeMarkers: string[];
  /** What a viewer can do after watching. Empty for pure entertainment. */
  outcome: string;
  prerequisites: string[];
  media: ReelMedia;
  stats: { likes: number; saves: number; plays: number };
  publishedAt: string;
  /** Set on reels ingested through the studio rather than shipped in the seed catalog. */
  userGenerated?: boolean;
  /** Present on reels imported from the ingest pipeline. */
  source?: ReelSource;
  imported?: boolean;
  /** Whether the language model filled in outcome/difficulty/substance. */
  enriched?: boolean;
}

/* --- Interaction --------------------------------------------------------- */

export const EVENT_TYPES = [
  "view",
  "complete",
  "replay",
  "like",
  "save",
  "share",
  "skip",
  "not_interested",
  "expand_caption",
  "open_profile",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface InteractionEvent {
  id: string;
  sessionId: string;
  reelId: string;
  type: EventType;
  at: string;
  /** Milliseconds actually watched across all passes. */
  watchedMs?: number;
  durationMs?: number;
  /** watchedMs / durationMs, uncapped so re-watches can exceed 1. */
  completion?: number;
  replays?: number;
}

/** One reel's rolled-up standing with the student, after weighting and decay. */
export interface ReelAffinity {
  reelId: string;
  /** −1 … +1. Negative means the student actively pushed it away. */
  score: number;
  /** Human-readable reason the score landed where it did. */
  basis: string[];
  lastSeenAt: string;
  events: number;
}

export interface TasteFacet {
  topic: string;
  weight: number;
  evidenceReelIds: string[];
}

export interface TasteProfile {
  sessionId: string;
  /** Unit-length taste embedding: positives pulled in, negatives pushed away. */
  vector: number[];
  facets: TasteFacet[];
  categories: Partial<Record<Category, number>>;
  genres: Partial<Record<Genre, number>>;
  /** 0 (beginner-leaning) … 1 (advanced-leaning), inferred from what holds attention. */
  difficultyBias: number;
  /** 0 … 1. How much evidence the profile rests on — drives confidence downstream. */
  signalStrength: number;
  affinities: ReelAffinity[];
  watchedReelIds: string[];
  updatedAt: string;
}

/* --- Inference ----------------------------------------------------------- */

export type AbstractionLevel = "surface" | "domain" | "motivation";

export interface AbstractionRung {
  level: AbstractionLevel;
  label: string;
  rationale: string;
}

export interface EvidenceItem {
  reelId: string;
  title: string;
  /** The specific behaviour that counted: "watched 3.1×", "saved", "skipped at 12%". */
  signal: string;
  weight: number;
}

export interface InterestInference {
  surfaceTopics: string[];
  /** Surface → domain → motivation. The core defence against shallow matching. */
  ladder: AbstractionRung[];
  primaryInterest: string;
  secondaryInterests: string[];
  underlyingMotivation: string;
  /** Where the student appears to be heading, when the signal supports a read. */
  careerSignal: string | null;
  evidence: EvidenceItem[];
  /** Explicit negative constraints: what would be a lazy or hollow match. */
  avoid: string[];
  confidence: Confidence;
  confidenceScore: number;
  /** True when the history is broad enough that a same-topic pick would be a mistake. */
  breadthDetected: boolean;
}

/* --- Retrieval and ranking ----------------------------------------------- */

export interface ScoredCandidate {
  reel: Reel;
  /** Cosine similarity against the retrieval query set. */
  similarity: number;
  /** Alignment with the rolled-up taste vector. */
  tasteFit: number;
  /** Post-MMR diversity contribution. */
  novelty: number;
  substance: number;
  difficultyFit: number;
  /** Final blended score used for ordering. */
  score: number;
  reasons: string[];
}

export type RejectionReason =
  | "hype"
  | "low-substance"
  | "same-subtopic"
  | "already-seen"
  | "difficulty-mismatch"
  | "off-interest"
  | "duplicate-creator";

export interface RejectedCandidate {
  reelId: string;
  title: string;
  reason: RejectionReason;
  detail: string;
  /** What it would have scored had the guardrail not caught it. */
  wouldHaveScored: number;
}

/* --- Output -------------------------------------------------------------- */

/** The eight fields the brief requires, verbatim in shape. */
export interface RecommendationCard {
  currentReel: string;
  interestDetected: string;
  why: string;
  recommendedTechReel: string;
  category: Category;
  whyThisRecommendation: string;
  difficulty: Difficulty;
  confidence: Confidence;
}

export type StageStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface AgentStage {
  key: string;
  label: string;
  detail: string;
  status: StageStatus;
  ms: number;
  /** Small numeric readouts rendered next to the stage in the trace UI. */
  metrics?: Record<string, string | number>;
}

export interface AgentDiagnostics {
  llmModel: string;
  llmUsed: boolean;
  embeddingProvider: string;
  embeddingDims: number;
  vectorStore: string;
  candidatesRetrieved: number;
  candidatesRejected: number;
  totalMs: number;
  tokens?: { prompt: number; completion: number };
  /** Set when the LLM was unavailable and the deterministic path produced the answer. */
  degraded?: string;
}

export interface AgentResult {
  card: RecommendationCard;
  /** The required output block, pre-rendered for copy/paste and for judges. */
  formatted: string;
  inference: InterestInference;
  recommendation: Reel;
  runnersUp: ScoredCandidate[];
  rejected: RejectedCandidate[];
  stages: AgentStage[];
  diagnostics: AgentDiagnostics;
  profile: TasteProfile;
}

/** What the shallow baseline produces, for the side-by-side comparison. */
export interface BaselineResult {
  card: RecommendationCard;
  formatted: string;
  method: string;
  matchedKeywords: string[];
  recommendation: Reel;
  critique: string[];
}
