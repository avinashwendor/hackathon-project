#!/usr/bin/env node
/**
 * PromptWars / hackathon submission checklist.
 * Prints a 100-point rubric with pass/fail and suggested total %.
 * Run from upstream/: npm run eval:submission
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

const checks = [
  {
    id: "problem",
    label: "Problem alignment (agent + trap)",
    weight: 20,
    paths: ["README.md", "lib/agent/infer.ts", "lib/agent/hype.ts", "app/trap/page.tsx"],
  },
  {
    id: "assistant",
    label: "Smart assistant / context",
    weight: 15,
    paths: ["lib/agent/format.ts", "app/agent/page.tsx", "app/api/agent/recommend/route.ts"],
  },
  {
    id: "ide",
    label: "Tech platform code editor",
    weight: 15,
    paths: [
      "app/code-editor/page.tsx",
      "components/BrowserCodeEditor.tsx",
      "components/MonacoCodeEditor.tsx",
      "docs/CODE_EDITOR.md",
    ],
  },
  {
    id: "quality",
    label: "Code quality (TS + lint scripts)",
    weight: 10,
    paths: ["package.json", "tsconfig.json"],
    extra: () => {
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      return Boolean(pkg.scripts?.typecheck && pkg.scripts?.lint && pkg.scripts?.verify);
    },
  },
  {
    id: "security",
    label: "Security (auth + headers)",
    weight: 10,
    paths: ["lib/auth.ts", "next.config.ts"],
  },
  {
    id: "tests",
    label: "Testing & verify gate",
    weight: 10,
    paths: ["scripts/eval-agent.mjs", "tests"],
    extra: () => {
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      return Boolean(pkg.scripts?.test && pkg.scripts?.["agent:eval"] && pkg.scripts?.verify);
    },
  },
  {
    id: "efficiency",
    label: "Efficiency patterns",
    weight: 5,
    paths: ["lib/feed/feed-cache.ts"],
  },
  {
    id: "a11y",
    label: "Accessibility baseline",
    weight: 5,
    paths: ["app/layout.tsx"],
  },
  {
    id: "google",
    label: "Google services",
    weight: 5,
    paths: ["lib/embeddings/index.ts", "app/layout.tsx"],
  },
  {
    id: "submit",
    label: "Submission docs",
    weight: 5,
    paths: ["docs/SUBMISSION.md", "docs/EVALUATION.md"],
  },
];

function exists(rel) {
  const p = join(root, rel);
  if (existsSync(p)) return true;
  return false;
}

let earned = 0;
let possible = 0;

console.log("\nUpstream submission rubric (100 points)\n");
console.log("─".repeat(72));

for (const row of checks) {
  possible += row.weight;
  const missing = row.paths.filter((p) => !exists(p));
  const extraOk = row.extra ? row.extra() : true;
  const pass = missing.length === 0 && extraOk;
  if (pass) earned += row.weight;

  const status = pass ? "PASS" : "FAIL";
  console.log(
    `${status.padEnd(5)} ${String(row.weight).padStart(2)} pts  ${row.label}`,
  );
  if (missing.length) {
    console.log(`       missing: ${missing.join(", ")}`);
  }
  if (!extraOk) {
    console.log("       missing: required npm scripts in package.json");
  }
}

console.log("─".repeat(72));
const pct = possible ? Math.round((earned / possible) * 100) : 0;
console.log(`\nSuggested score from repo evidence: ${earned}/${possible} (${pct}%)\n`);
console.log("Verify live: /code-editor, /lab, /agent, /trap, curl /api/health on deploy");
console.log("Full rubric: docs/EVALUATION.md\n");

process.exit(earned === possible ? 0 : 1);
