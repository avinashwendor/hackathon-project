import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHype, HYPE_BLOCK_THRESHOLD } from "@/lib/agent/hype";

/* The guardrail the brief calls out by name. These cases are the contract:
   anything that promises an outcome is refused, anything that merely describes
   a topic is not. Both directions matter — a false positive silently deletes a
   good reel from the recommendable pool. */

describe("hype guardrail", () => {
  it("blocks outcome promises", () => {
    const verdict = detectHype("10 AI tools that will get you a job in 2026");
    assert.ok(verdict.blocked, "should block a job promise");
    assert.ok(verdict.score >= HYPE_BLOCK_THRESHOLD);
  });

  it("blocks salary flex and impossible timelines", () => {
    assert.ok(detectHype("How I cracked a 50 LPA package in 3 months").blocked);
    assert.ok(detectHype("Master Java in 10 minutes").blocked);
  });

  it("blocks engagement bait and lead capture", () => {
    assert.ok(detectHype("Comment the answer below and I'll send it").blocked);
    assert.ok(detectHype("Full roadmap, link in bio, free AI toolkit").blocked);
  });

  it("blocks conspiracy framing and manufactured stats", () => {
    assert.ok(detectHype("The shortcut colleges don't want you to know").blocked);
    assert.ok(detectHype("Only 1% of programmers know this").blocked);
  });

  it("does NOT block ordinary descriptive titles", () => {
    const safe = [
      "What actually happens inside HashMap.put()",
      "React.js shell shocked by 10.0 critical vulnerability",
      "Software engineers have some controversial opinions",
      "TCP / IP explained in 60 seconds",
      "Why your Docker build takes 9 minutes every time",
      "Everything you need to know about Linux",
    ];
    for (const title of safe) {
      const verdict = detectHype(title);
      assert.equal(verdict.blocked, false, `should not block: "${title}" (${verdict.kinds})`);
    }
  });

  it("treats an uncorroborated model marker as advisory, never as a block", () => {
    // The enrichment model over-flags descriptive phrases. One of those alone
    // must not be able to delete a reel.
    const verdict = detectHype("A calm explainer about database indexes", ["controversial opinions"]);
    assert.equal(verdict.blocked, false);
    assert.ok(verdict.score > 0, "it should still register as a soft signal");
  });

  it("counts a corroborated marker at full weight", () => {
    const verdict = detectHype("Some title", ["link in bio"]);
    assert.ok(verdict.blocked, "a marker the lexicon also recognises should block");
  });

  it("saturates rather than summing past 1", () => {
    const verdict = detectHype(
      "10 AI tools that will get you a job. Nobody is talking about this. Comment HIRED. Link in bio.",
    );
    assert.ok(verdict.score <= 1);
  });
});
