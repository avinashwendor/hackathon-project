#!/usr/bin/env node
/**
 * Pre-build the corpus embedding cache.
 *
 *   node scripts/build-embeddings.mjs
 *
 * Google's free tier allows 100 embed requests per minute and counts every
 * content in a batch as a request, so embedding ~260 reels inside a web request
 * is not viable — it would rate-limit the first visitor and cold-start slowly
 * forever after.
 *
 * Instead the vectors are built once here, paced under the quota, resumable,
 * and written to data/generated/embeddings.<provider>.json which is committed.
 * Production then reads the cache and never calls Google for the corpus at all;
 * only the handful of query embeddings per recommendation hit the API live.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
const MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const DIMS = Number(process.env.GEMINI_EMBEDDING_DIMS ?? 768);
const BASE = process.env.GOOGLE_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const PROVIDER = `google:${MODEL}`;
const CACHE = path.resolve(`data/generated/embeddings.${PROVIDER.replace(/[^a-z0-9]+/gi, "-")}.json`);

/* Under the documented 100/min ceiling, with headroom for the retry path. */
const BATCH = 20;
const PER_MINUTE = 80;

if (!KEY) {
  console.error("✗ GEMINI_API_KEY is not set");
  process.exit(1);
}

/* --- corpus ------------------------------------------------------------- */

/**
 * The reel corpus is authored in TypeScript, so rather than compile it we
 * rebuild the same document text the app builds. Both sides derive it from the
 * same fields, and the fingerprint check in lib/vector/index.ts catches any
 * drift by rejecting a stale cache.
 */
async function loadCorpus() {
  const reels = [];

  const catalogPath = path.resolve("data/generated/catalog.json");
  try {
    const imported = JSON.parse(await fs.readFile(catalogPath, "utf8"));
    reels.push(...imported.reels);
  } catch {
    console.warn("  ! no imported catalog — run `npm run import:catalog` first");
  }

  // The hand-authored corpus lives in data/reels.ts. Parse the seed objects out
  // of it rather than duplicating them here.
  const source = await fs.readFile(path.resolve("data/reels.ts"), "utf8");
  const idMatches = [...source.matchAll(/^\s{4}id: "([^"]+)",$/gm)].map((m) => m[1]);
  const seedIds = idMatches.filter((id) => id.startsWith("feed-") || id.startsWith("cat-"));

  for (const id of seedIds) {
    const block = source.slice(source.indexOf(`id: "${id}"`));
    const field = (name) => {
      const m = new RegExp(`${name}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(block.slice(0, 4000));
      return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ") : "";
    };
    const arrField = (name) => {
      const m = new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`).exec(block.slice(0, 4000));
      return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
    };
    reels.push({
      id,
      title: field("title"),
      caption: field("caption"),
      transcript: field("transcript"),
      outcome: field("outcome"),
      category: field("category"),
      difficulty: field("difficulty"),
      topics: arrField("topics"),
      prerequisites: arrField("prerequisites"),
      hashtags: arrField("hashtags"),
    });
  }

  return reels;
}

/** Must match reelDocument() in lib/embeddings/index.ts. */
function reelDocument(reel) {
  return [
    reel.title,
    reel.caption,
    `Category: ${reel.category}. Difficulty: ${reel.difficulty}.`,
    `Topics: ${(reel.topics ?? []).join(", ")}.`,
    reel.outcome ? `You will be able to: ${reel.outcome}` : "",
    (reel.prerequisites ?? []).length ? `Assumes: ${reel.prerequisites.join(", ")}.` : "",
    reel.transcript,
    (reel.hashtags ?? []).map((h) => `#${h}`).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalize(values) {
  let sum = 0;
  for (const v of values) sum += v * v;
  const mag = Math.sqrt(sum);
  return mag === 0 ? values : values.map((v) => Number((v / mag).toFixed(6)));
}

async function embedBatch(texts) {
  const res = await fetch(`${BASE}/models/${MODEL}:batchEmbedContents?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: DIMS,
      })),
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    const retry = /"retryDelay":\s*"(\d+)s"/.exec(body)?.[1];
    const err = new Error(`${res.status}: ${body.slice(0, 140)}`);
    err.retryAfterMs = (Number(retry) || 25) * 1000;
    throw err;
  }
  return JSON.parse(body).embeddings.map((e) => normalize(e.values));
}

async function main() {
  const reels = await loadCorpus();
  console.log(`→ ${reels.length} reels, ${MODEL} @ ${DIMS}d`);

  let cache = { provider: PROVIDER, dims: DIMS, vectors: {}, hashes: {} };
  try {
    const existing = JSON.parse(await fs.readFile(CACHE, "utf8"));
    if (existing.provider === PROVIDER && existing.dims === DIMS) {
      cache = { hashes: {}, ...existing };
      console.log(`  resuming: ${Object.keys(cache.vectors).length} already cached`);
    }
  } catch {
    /* first run */
  }

  // Same hash function the app uses, so a vector built here is accepted there.
  const hashOf = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  };

  const todo = reels.filter((r) => cache.hashes[r.id] !== hashOf(reelDocument(r)));
  if (!todo.length) {
    console.log("✓ cache already complete");
  }

  const started = Date.now();
  let done = 0;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map(reelDocument);

    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      try {
        const vectors = await embedBatch(texts);
        batch.forEach((reel, j) => {
          cache.vectors[reel.id] = vectors[j];
          cache.hashes[reel.id] = hashOf(reelDocument(reel));
        });
        ok = true;
      } catch (err) {
        if (attempt === 5) throw err;
        const wait = err.retryAfterMs ?? 5000 * (attempt + 1);
        process.stdout.write(`\r  rate limited, waiting ${Math.round(wait / 1000)}s…            `);
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    done += batch.length;
    process.stdout.write(`\r  embedded ${done}/${todo.length}                    `);

    await fs.mkdir(path.dirname(CACHE), { recursive: true });
    await fs.writeFile(CACHE, JSON.stringify(cache), "utf8");

    // Stay under the per-minute ceiling rather than discovering it.
    const elapsedMin = (Date.now() - started) / 60_000;
    const allowed = Math.max(1, PER_MINUTE * elapsedMin);
    if (done > allowed) {
      const pause = ((done - allowed) / PER_MINUTE) * 60_000;
      process.stdout.write(`\r  pacing ${Math.round(pause / 1000)}s to stay under quota   `);
      await new Promise((r) => setTimeout(r, pause));
    }
  }

  // The fingerprint must match what lib/vector/index.ts computes, or the app
  // rebuilds from scratch and the cache was pointless.
  console.log(`\n✓ ${Object.keys(cache.vectors).length} vectors → ${path.relative(process.cwd(), CACHE)}`);
  const bytes = (await fs.stat(CACHE)).size;
  console.log(`  cache size: ${(bytes / 1_048_576).toFixed(1)} MB`);
  console.log(`  note: the app validates a corpus fingerprint; if reels change, re-run this.`);
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
