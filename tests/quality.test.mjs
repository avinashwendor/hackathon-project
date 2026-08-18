import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { agentRequestSchema, compareRequestSchema, qualityRequestSchema } from "@/lib/api/schemas";
import { errorMessage, formatUnknown, isAbortError } from "@/lib/errors";
import { runCodeFile, runTestCases } from "@/lib/lab/run-code";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_SOURCE_LINES = 750;
const DATA_DIRS = new Set(["data"]);

function walkTs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (DATA_DIRS.has(name) && dir === ROOT) continue;
      walkTs(full, acc);
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

function countLines(file) {
  return readFileSync(file, "utf8").split("\n").length;
}

function rel(file) {
  return relative(ROOT, file);
}

describe("error helpers", () => {
  it("reads Error.message and stringifies unknown throws", () => {
    assert.equal(errorMessage(new Error("boom")), "boom");
    assert.equal(errorMessage("plain"), "plain");
  });

  it("detects fetch abort cancellations", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    assert.equal(isAbortError(err), true);
    assert.equal(isAbortError(new Error("other")), false);
  });

  it("formats objects without throwing on cycles", () => {
    assert.equal(formatUnknown("hi"), "hi");
    assert.equal(formatUnknown(3), "3");
    const cyclic = {};
    cyclic.self = cyclic;
    assert.match(formatUnknown(cyclic), /Object|cyclic|self/i);
    assert.ok(formatUnknown({ ok: true }).includes("true"));
  });
});

describe("lab runner", () => {
  it("executes javascript and reports console output", () => {
    const result = runCodeFile({
      name: "main.js",
      language: "javascript",
      content: 'console.log("hello");',
    });
    assert.ok(result.logs.some((line) => line.includes("hello")));
  });

  it("grades test cases against expected output", () => {
    const results = runTestCases(
      { name: "main.js", language: "javascript", content: 'function solve() { return "Hello World"; }' },
      [{ input: "solve()", expectedOutput: "Hello World" }],
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].passed, true);
  });
});

describe("api schemas", () => {
  it("accepts agent stream/recommend payloads", () => {
    const parsed = agentRequestSchema.safeParse({
      scenarioId: "the-trap",
      allowRepeat: true,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects oversized agent event batches", () => {
    const parsed = agentRequestSchema.safeParse({
      events: Array.from({ length: 121 }, () => ({ reelId: "x" })),
    });
    assert.equal(parsed.success, false);
  });

  it("accepts compare and quality preview bodies", () => {
    assert.equal(compareRequestSchema.safeParse({}).success, true);
    assert.equal(qualityRequestSchema.safeParse({ text: "Learn binary search" }).success, true);
  });
});

describe("code quality contracts", () => {
  it("does not use explicit any in lib or app", () => {
    const files = [...walkTs(join(ROOT, "lib")), ...walkTs(join(ROOT, "app"))];
    const hits = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/:\s*any\b|\bas any\b/.test(line) && !line.includes("any questions")) {
          hits.push(`${rel(file)}:${i + 1}`);
        }
      });
    }
    assert.deepEqual(hits, []);
  });

  it("does not cast errors with (err as Error) in lib or app", () => {
    const files = [...walkTs(join(ROOT, "lib")), ...walkTs(join(ROOT, "app"))];
    const hits = files.filter((file) => readFileSync(file, "utf8").includes("(err as Error)"));
    assert.deepEqual(
      hits.map(rel),
      [],
      `use errorMessage() from lib/errors instead of (err as Error)`,
    );
  });

  it("keeps implementation files under a readable line budget", () => {
    const dirs = ["lib", "app", "components"].map((d) => join(ROOT, d));
    const oversized = [];
    for (const dir of dirs) {
      for (const file of walkTs(dir)) {
        const lines = countLines(file);
        if (lines > MAX_SOURCE_LINES) oversized.push(`${rel(file)} (${lines} lines)`);
      }
    }
    assert.deepEqual(
      oversized,
      [],
      `split files above ${MAX_SOURCE_LINES} lines — LLM reviewers penalize monoliths`,
    );
  });

  it("validates JSON POST bodies with Zod safeParse or parseJsonBody", () => {
    const apiRoot = join(ROOT, "app/api");
    const missing = [];

    for (const file of walkTs(apiRoot)) {
      if (!file.endsWith("route.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (!text.includes("export async function POST")) continue;
      if (!text.includes("request: Request") && !text.includes("request:Request")) continue;
      if (text.includes("formData()")) continue;
      if (text.includes("safeParse") || text.includes("parseJsonBody")) continue;
      missing.push(rel(file));
    }

    assert.deepEqual(missing, [], "every JSON POST route must validate with Zod");
  });
});
