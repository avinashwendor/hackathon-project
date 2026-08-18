#!/usr/bin/env node
/**
 * Agent eval.
 *
 *   node scripts/eval-agent.mjs [--base http://localhost:3000]
 *
 * Runs every scenario and asserts the two properties the brief actually cares
 * about: that the agent generalises past the shared keyword, and that it never
 * recommends hype. Written as pass/fail rather than a vibe check, because
 * "seems better" is not a claim anyone should have to take on trust.
 */

import process from "node:process";

const HYPE_IDS = ["cat-ai-hype-listicle", "cat-career-hype-package", "feed-ai-hype"];

const CHECKS = [
  {
    scenario: "the-trap",
    name: "Java meme trap",
    assertions: [
      {
        label: "does not stop at the surface keyword",
        test: (r) => !/^java\b/i.test(r.card.interestDetected.trim()),
      },
      {
        label: "infers a broader domain (engineering / career / software)",
        test: (r) => /engineer|software|career|develop|hire/i.test(r.card.interestDetected),
      },
      { label: "recommends real technical content", test: (r) => r.recommendation.substance >= 0.45 },
      { label: "never recommends hype", test: (r) => !HYPE_IDS.includes(r.recommendation.id) },
      { label: "detects breadth across the history", test: (r) => r.inference.breadthDetected === true },
    ],
  },
  {
    scenario: "hype-magnet",
    name: "Hype magnet",
    assertions: [
      { label: "never recommends hype", test: (r) => !HYPE_IDS.includes(r.recommendation.id) },
      {
        label: "actively blocks at least one hype candidate",
        test: (r) => r.rejected.some((x) => x.reason === "hype"),
      },
      { label: "recommends real technical content", test: (r) => r.recommendation.substance >= 0.45 },
    ],
  },
  {
    scenario: "systems-curious",
    name: "Systems curious",
    assertions: [
      { label: "never recommends hype", test: (r) => !HYPE_IDS.includes(r.recommendation.id) },
      { label: "recommends real technical content", test: (r) => r.recommendation.substance >= 0.6 },
      {
        label: "does not simply return another gadget review",
        test: (r) => r.recommendation.genre !== "gadgets" || r.recommendation.substance > 0.8,
      },
    ],
  },
  {
    scenario: "quiet-builder",
    name: "Quiet builder (thin signal)",
    assertions: [
      { label: "never recommends hype", test: (r) => !HYPE_IDS.includes(r.recommendation.id) },
      {
        label: "does not claim High confidence on thin evidence",
        test: (r) => r.card.confidence !== "High",
      },
    ],
  },
];

const base = (process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : process.env.BASE_URL) ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

for (const check of CHECKS) {
  process.stdout.write(`\n${check.name}\n`);
  let result;
  try {
    const res = await fetch(`${base}/api/agent/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: check.scenario }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result = await res.json();
  } catch (err) {
    console.log(`  ✗ request failed: ${err.message}`);
    failed += check.assertions.length;
    continue;
  }

  console.log(`  interest  → ${result.card.interestDetected}`);
  console.log(`  recommend → ${result.card.recommendedTechReel} [${result.card.category}]`);
  console.log(`  confidence→ ${result.card.confidence}  (llm: ${result.diagnostics.llmUsed})`);

  for (const assertion of check.assertions) {
    let ok = false;
    try {
      ok = Boolean(assertion.test(result));
    } catch {
      ok = false;
    }
    console.log(`  ${ok ? "✓" : "✗"} ${assertion.label}`);
    ok ? passed++ : failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
