import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCENARIO_BY_ID, SCENARIOS, scenarioToEvents } from "@/data/scenarios";
import { getReel } from "@/data/reels";
import { inferDeterministic } from "@/lib/agent/infer";
import { computeAffinities } from "@/lib/agent/signals";
import { INFERENCE_SYSTEM, buildInferencePrompt } from "@/lib/llm/prompts";
import { extractJson, llmConfigured } from "@/lib/llm/client";

function profileFromScenario(scenario) {
  const events = scenarioToEvents(scenario, "eval", (id) => getReel(id)?.durationSec ?? 30);
  const now = Date.now();
  const affinities = computeAffinities(events, now);
  return {
    sessionId: "eval",
    vector: [],
    facets: [],
    categories: {},
    genres: {},
    difficultyBias: 0.3,
    signalStrength: Math.min(1, affinities.filter((a) => a.score > 0).length / 4),
    affinities,
    watchedReelIds: affinities.map((a) => a.reelId),
    updatedAt: new Date(now).toISOString(),
  };
}

describe("deterministic inference (the trap)", () => {
  it("ships four named scenarios the eval script can replay", () => {
    assert.deepEqual(
      SCENARIOS.map((s) => s.id),
      ["the-trap", "hype-magnet", "systems-curious", "quiet-builder"],
    );
    assert.equal(SCENARIO_BY_ID.get("the-trap")?.currentReelId, "feed-java-meme");
  });

  it("climbs past the shared Java keyword on the trap history", () => {
    const scenario = SCENARIO_BY_ID.get("the-trap");
    const current = getReel(scenario.currentReelId);
    const inference = inferDeterministic(current, profileFromScenario(scenario));
    const blob = `${inference.primaryInterest} ${inference.underlyingMotivation} ${inference.ladder
      .map((r) => r.label)
      .join(" ")}`.toLowerCase();
    assert.ok(
      scenario.expected.interestContains.some((needle) => blob.includes(needle)),
      `expected one of ${scenario.expected.interestContains} in "${blob}"`,
    );
    assert.equal(inference.breadthDetected, true, "four distinct topics must trip breadth");
    assert.equal(inference.ladder.length, 3);
    assert.deepEqual(
      inference.ladder.map((r) => r.level),
      ["surface", "domain", "motivation"],
    );
  });

  it("does not claim High confidence on the quiet-builder's thin evidence", () => {
    const scenario = SCENARIO_BY_ID.get("quiet-builder");
    const current = getReel(scenario.currentReelId);
    const inference = inferDeterministic(current, profileFromScenario(scenario));
    assert.notEqual(inference.confidence, "High");
    assert.ok(inference.confidenceScore < 0.68);
  });

  it("always avoids hype listicles in the trap reading", () => {
    const scenario = SCENARIO_BY_ID.get("the-trap");
    const current = getReel(scenario.currentReelId);
    const inference = inferDeterministic(current, profileFromScenario(scenario));
    assert.ok(inference.avoid.some((line) => /listicle|outcome promise/i.test(line)));
  });
});

describe("inference prompt contract", () => {
  it("prohibits answering with the shared keyword when history is broader", () => {
    assert.match(INFERENCE_SYSTEM, /coincidence of vocabulary/i);
    assert.match(INFERENCE_SYSTEM, /Never claim High confidence from a single reel/i);
  });

  it("embeds the current reel and affinities into the user prompt", () => {
    const reel = getReel("feed-java-meme");
    const profile = profileFromScenario(SCENARIO_BY_ID.get("the-trap"));
    const prompt = buildInferencePrompt({ currentReel: reel, profile });
    assert.ok(prompt.includes(reel.title));
    assert.match(prompt, /VIEWING HISTORY/i);
  });
});

describe("LLM JSON repair", () => {
  it("extracts a fenced object and ignores surrounding prose", () => {
    const raw = 'Sure.\n```json\n{"primaryInterest":"career","confidence":"Medium"}\n```\n';
    assert.equal(extractJson(raw), '{"primaryInterest":"career","confidence":"Medium"}');
  });

  it("returns null when there is no object", () => {
    assert.equal(extractJson("no json here"), null);
  });

  it("reports whether a generation key is configured without throwing", () => {
    assert.equal(typeof llmConfigured(), "boolean");
  });
});
