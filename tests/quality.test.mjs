import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { errorMessage, formatUnknown } from "@/lib/errors";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkTs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "data") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkTs(full, acc);
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

describe("error helpers", () => {
  it("reads Error.message and stringifies unknown throws", () => {
    assert.equal(errorMessage(new Error("boom")), "boom");
    assert.equal(errorMessage("plain"), "plain");
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

describe("code quality contracts", () => {
  it("does not use explicit any in lib or app", () => {
    const files = [...walkTs(join(ROOT, "lib")), ...walkTs(join(ROOT, "app"))];
    const hits = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (/:\s*any\b|\bas any\b/.test(line) && !line.includes("any questions")) {
          hits.push(`${file.slice(ROOT.length + 1)}:${i + 1}`);
        }
      });
    }
    assert.deepEqual(hits, []);
  });
});
