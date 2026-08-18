import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  difficultyLabel,
  negativeAffinities,
  positiveAffinities,
  rankedCategories,
} from "@/lib/agent/taste";

function affinity(reelId, score) {
  return { reelId, score, basis: ["test"], lastSeenAt: new Date().toISOString(), events: 1 };
}

function profile(overrides = {}) {
  return {
    sessionId: "t",
    vector: [],
    facets: [],
    categories: { Career: 1.2, DSA: 0.4, Other: -0.3 },
    genres: {},
    difficultyBias: 0.2,
    signalStrength: 0.5,
    affinities: [affinity("strong", 0.8), affinity("weak", 0.05), affinity("skip", -0.4)],
    watchedReelIds: ["strong", "weak", "skip"],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("taste profile helpers", () => {
  it("maps difficulty bias onto the three labels the card uses", () => {
    assert.equal(difficultyLabel(0), "Beginner");
    assert.equal(difficultyLabel(0.33), "Beginner");
    assert.equal(difficultyLabel(0.34), "Intermediate");
    assert.equal(difficultyLabel(0.66), "Intermediate");
    assert.equal(difficultyLabel(0.67), "Advanced");
    assert.equal(difficultyLabel(1), "Advanced");
  });

  it("keeps only affinities that are real evidence, not noise", () => {
    const positives = positiveAffinities(profile(), 6);
    assert.deepEqual(
      positives.map((a) => a.reelId),
      ["strong"],
    );
  });

  it("surfaces the strongest negatives first so skips can suppress retrieval", () => {
    const negatives = negativeAffinities(profile(), 4);
    assert.equal(negatives[0].reelId, "skip");
    assert.ok(negatives[0].score < 0);
  });

  it("ranks named categories and drops suppressed ones", () => {
    const ranked = rankedCategories(profile());
    assert.equal(ranked[0].category, "Career");
    assert.ok(!ranked.some((row) => row.category === "Other"));
  });

  it("respects the positive affinity limit", () => {
    const many = profile({
      affinities: Array.from({ length: 10 }, (_, i) => affinity(`r${i}`, 0.5)),
    });
    assert.equal(positiveAffinities(many, 3).length, 3);
  });
});
