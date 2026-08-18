import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_FIELDS, formatCard } from "@/lib/agent/format";

const card = {
  currentReel: "Java asking if you're SURE you want a String (@stacktrace.jpg, Java)",
  interestDetected: "Becoming a hireable software engineer",
  why: "Saved a day-in-the-life reel; re-watched an interview joke.",
  recommendedTechReel: "Rewrite one resume bullet with me",
  category: "Career",
  whyThisRecommendation: "Teaches one checkable skill instead of promising an outcome.",
  difficulty: "Beginner",
  confidence: "High",
};

/* The brief specifies eight fields in a fixed order. This is a contract test:
   if the output drifts, the submission stops matching the required format. */

describe("required output format", () => {
  it("emits all eight fields, in order", () => {
    const lines = formatCard(card).split("\n");
    assert.equal(lines.length, 8);
    CARD_FIELDS.forEach((field, i) => {
      assert.ok(lines[i].startsWith(`* ${field}: `), `line ${i} should be "${field}"`);
    });
  });

  it("carries the values through unaltered", () => {
    const output = formatCard(card);
    for (const value of Object.values(card)) {
      assert.ok(output.includes(value), `missing value: ${value}`);
    }
  });

  it("names the fields exactly as the brief does", () => {
    assert.deepEqual([...CARD_FIELDS], [
      "CURRENT REEL",
      "INTEREST DETECTED",
      "WHY",
      "RECOMMENDED TECH REEL",
      "CATEGORY",
      "WHY THIS RECOMMENDATION",
      "DIFFICULTY",
      "CONFIDENCE",
    ]);
  });
});
