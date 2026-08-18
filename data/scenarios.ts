import type { InteractionEvent } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Demo scenarios.

   Each one is a real interaction history, not a list of topics — completion
   ratios, replays, saves and early skips, exactly what the signal layer reads.
   The first scenario is the trap from the brief: four reels whose only shared
   keyword is "Java", where the correct inference is a domain, not a language.
--------------------------------------------------------------------------- */

export interface ScenarioStep {
  reelId: string;
  /** Fraction of the reel watched. >1 means it was re-watched. */
  completion: number;
  replays?: number;
  liked?: boolean;
  saved?: boolean;
  shared?: boolean;
  notInterested?: boolean;
  /** Minutes before "now" that this happened. */
  minutesAgo: number;
}

export interface Scenario {
  id: string;
  name: string;
  tagline: string;
  /** Why this scenario is interesting to look at. */
  premise: string;
  /** The reel the student is on right now. */
  currentReelId: string;
  history: ScenarioStep[];
  /** What a shallow keyword system would do — shown on the comparison page. */
  shallowTrap: string;
  /** What a good agent should conclude. Used by the eval script, never by the agent. */
  expected: {
    interestContains: string[];
    rejectCategories?: string[];
    notRecommend?: string[];
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "the-trap",
    name: "The Java meme trap",
    tagline: "Four reels, one shared keyword, and the wrong obvious answer",
    premise:
      "A student watches a Java meme, a software-engineer day-in-the-life, a coding interview joke and a laptop comparison. The only literal overlap is the word 'Java'. The shallow read is 'likes Java'. The honest read is a student orienting themselves toward a software engineering career — and the laptop reel is the tell, because it has nothing to do with Java at all.",
    currentReelId: "feed-java-meme",
    history: [
      { reelId: "feed-java-meme", completion: 2.4, replays: 2, liked: true, minutesAgo: 2 },
      { reelId: "feed-swe-lifestyle", completion: 0.96, saved: true, minutesAgo: 9 },
      { reelId: "feed-interview-joke", completion: 1.8, replays: 1, liked: true, minutesAgo: 14 },
      { reelId: "feed-laptop-compare", completion: 0.91, saved: true, minutesAgo: 22 },
      { reelId: "feed-sangeet", completion: 0.12, minutesAgo: 27 },
      { reelId: "feed-valorant", completion: 0.34, minutesAgo: 31 },
    ],
    shallowTrap:
      "Keyword overlap ranks 'Java' highest, so a naive system serves another Java meme — more of the same joke, zero new capability.",
    expected: {
      interestContains: ["software engineering", "career", "engineer"],
      rejectCategories: [],
      notRecommend: ["cat-ai-hype-listicle", "cat-career-hype-package"],
    },
  },
  {
    id: "hype-magnet",
    name: "The hype magnet",
    tagline: "High engagement on content that promises everything and teaches nothing",
    premise:
      "This student engages hardest with listicles and package-flex reels. Engagement says 'give them more of that'. The agent has to serve the real interest underneath — wanting a job — without feeding the hype loop that keeps them anxious and untrained.",
    currentReelId: "feed-ai-hype",
    history: [
      { reelId: "feed-ai-hype", completion: 1.4, replays: 1, liked: true, saved: true, minutesAgo: 1 },
      { reelId: "feed-swe-lifestyle", completion: 0.78, minutesAgo: 8 },
      { reelId: "feed-interview-joke", completion: 0.94, liked: true, minutesAgo: 12 },
      { reelId: "feed-java-meme", completion: 0.62, minutesAgo: 19 },
      { reelId: "feed-valorant", completion: 0.21, minutesAgo: 24 },
    ],
    shallowTrap:
      "Engagement-optimised ranking sees a saved, re-watched, liked listicle and serves '7 AI tools that will replace your degree' next.",
    expected: {
      interestContains: ["career", "job", "employab"],
      rejectCategories: ["hype"],
      notRecommend: ["cat-ai-hype-listicle", "cat-career-hype-package"],
    },
  },
  {
    id: "systems-curious",
    name: "The systems-curious scroller",
    tagline: "Watches hardware and news reels to the end, skips the memes",
    premise:
      "Nothing here is labelled 'system design'. The student watches an inference-chip explainer twice, finishes a laptop comparison, and skips both memes in under two seconds. The signal is a taste for how things work underneath — which lifts to architecture and performance, not to more gadget reviews.",
    currentReelId: "feed-tech-news",
    history: [
      { reelId: "feed-tech-news", completion: 2.1, replays: 1, saved: true, minutesAgo: 3 },
      { reelId: "feed-laptop-compare", completion: 1.0, liked: true, minutesAgo: 11 },
      { reelId: "feed-java-meme", completion: 0.08, minutesAgo: 16 },
      { reelId: "feed-sangeet", completion: 0.05, notInterested: true, minutesAgo: 18 },
      { reelId: "feed-valorant", completion: 0.15, minutesAgo: 21 },
      { reelId: "feed-swe-lifestyle", completion: 0.55, minutesAgo: 26 },
    ],
    shallowTrap:
      "Keyword matching on 'laptop' and 'chip' serves another gadget review — the same surface, no depth.",
    expected: {
      interestContains: ["how", "system", "performance", "hardware", "underneath"],
      notRecommend: ["cat-ai-hype-listicle"],
    },
  },
  {
    id: "quiet-builder",
    name: "The quiet builder",
    tagline: "Barely interacts, but finishes anything that shows real code",
    premise:
      "No likes, no saves, almost no signal — the hardest case. The only thing that separates the reels is completion, and the pattern is that anything with concrete engineering finishes and anything performative gets skipped. The agent must recommend on thin evidence and say so by lowering its confidence rather than inventing certainty.",
    currentReelId: "feed-swe-lifestyle",
    history: [
      { reelId: "feed-swe-lifestyle", completion: 0.88, minutesAgo: 4 },
      { reelId: "feed-tech-news", completion: 0.81, minutesAgo: 13 },
      { reelId: "feed-ai-hype", completion: 0.11, minutesAgo: 17 },
      { reelId: "feed-sangeet", completion: 0.19, minutesAgo: 20 },
    ],
    shallowTrap:
      "With no likes or saves, an engagement-only system has nothing to rank on and falls back to what is globally popular — the listicle.",
    expected: {
      interestContains: ["engineering", "practical", "craft", "software"],
      notRecommend: ["cat-ai-hype-listicle", "cat-career-hype-package"],
    },
  },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

/** Expand a scenario's compact steps into the event stream the pipeline consumes. */
export function scenarioToEvents(
  scenario: Scenario,
  sessionId: string,
  durationOf: (reelId: string) => number,
): InteractionEvent[] {
  const events: InteractionEvent[] = [];
  let seq = 0;
  const push = (
    step: ScenarioStep,
    type: InteractionEvent["type"],
    extra: Partial<InteractionEvent> = {},
  ) => {
    events.push({
      id: `${scenario.id}-${seq++}`,
      sessionId,
      reelId: step.reelId,
      type,
      at: new Date(Date.now() - step.minutesAgo * 60_000).toISOString(),
      ...extra,
    });
  };

  for (const step of scenario.history) {
    const durationMs = durationOf(step.reelId) * 1000;
    push(step, "view", {
      durationMs,
      watchedMs: Math.round(durationMs * step.completion),
      completion: step.completion,
      replays: step.replays ?? 0,
    });
    if (step.completion >= 0.9) push(step, "complete", { completion: step.completion, durationMs });
    if ((step.replays ?? 0) > 0) push(step, "replay", { replays: step.replays });
    if (step.liked) push(step, "like");
    if (step.saved) push(step, "save");
    if (step.shared) push(step, "share");
    if (step.notInterested) push(step, "not_interested");
    if (step.completion < 0.25 && !step.notInterested) push(step, "skip", { completion: step.completion });
  }

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
