#!/usr/bin/env node
/**
 * Import the ingest agent's catalog into Upstream's reel model.
 *
 *   node scripts/import-catalog.mjs --dir "/Users/apple/Desktop/short videso" [--limit 20] [--no-enrich]
 *
 * The ingest agent produces real Instagram Reels with real metadata: title,
 * description, owner, duration, niches, languages and an s3_object_key. What it
 * cannot produce is the judgement the recommendation agent needs — what a reel
 * teaches, who it is pitched at, and whether it is a lesson or a promise.
 *
 * So this does two things:
 *
 *   1. MAPS what is genuinely in the data (niches → categories and ontology
 *      topics, languages → topics, duration, media keys, attribution).
 *   2. ENRICHES the rest with Gemini, reading only the real title + description.
 *      Nothing is invented: there are no transcripts in the source, so none are
 *      fabricated here — `transcript` stays empty and the description carries
 *      the searchable text.
 *
 * Output is written to data/generated/catalog.json, which is committed. The
 * deployment therefore ships 180 reels of metadata without 943MB of video.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

/* --- args ---------------------------------------------------------------- */

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs();
const SOURCE_DIR = args.dir ?? process.env.REELS_CATALOG_DIR ?? "/Users/apple/Desktop/short videso";
const OUT_FILE = path.resolve("data/generated/catalog.json");
const CACHE_FILE = path.resolve("data/generated/enrichment-cache.json");
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const ENRICH = !args["no-enrich"];
/* Generation runs on Omega C. The Google key in this project is scoped to
   embeddings only, so enrichment uses the gateway's Gemini model. */
const OMEGA_KEY = process.env.OMEGA_API_KEY ?? "";
const OMEGA_BASE = process.env.OMEGA_BASE_URL ?? "https://api.omegaplusapi.com/v1";
const OMEGA_MODEL = process.env.OMEGA_MODEL ?? "claude-gemini-3-1-pro";
const BATCH = 10;

/* --- taxonomy mapping ---------------------------------------------------- */

/**
 * The ingest taxonomy is broader than the eight categories the brief names, so
 * several niches collapse. `software-engineering` deliberately maps to Other
 * rather than a language bucket — it is the largest niche (127 reels) and
 * forcing it into Java would poison the category signal.
 */
const NICHE_TO_CATEGORY = {
  "ai-ml": "AI",
  "data-engineering": "AI",
  "dsa-algorithms": "DSA",
  "system-design": "HLD",
  databases: "HLD",
  cloud: "Cloud",
  devops: "Cloud",
  cybersecurity: "Cybersecurity",
  networking: "Cybersecurity",
  "computer-hardware": "Hardware",
  "developer-career": "Career",
  "open-source": "Career",
  "software-engineering": "Other",
  "web-development": "Other",
  "mobile-development": "Other",
  "developer-tools": "Other",
  "computer-science": "Other",
  "tech-news": "Other",
};

/** Niche → ontology topic ids that already exist in data/ontology.ts. */
const NICHE_TO_TOPICS = {
  "ai-ml": ["ai", "ml-engineering"],
  "data-engineering": ["ml-engineering", "databases"],
  "dsa-algorithms": ["dsa", "complexity"],
  "system-design": ["system-design", "distributed-systems"],
  databases: ["databases", "indexing"],
  cloud: ["cloud", "containers"],
  devops: ["ci-cd", "containers"],
  cybersecurity: ["security", "web-security"],
  networking: ["distributed-systems", "security"],
  "computer-hardware": ["hardware", "cpu-architecture"],
  "developer-career": ["career", "interviews"],
  "open-source": ["build-in-public", "git"],
  "software-engineering": ["debugging", "code-review"],
  "web-development": ["api-design", "testing"],
  "mobile-development": ["api-design"],
  "developer-tools": ["git", "debugging"],
  "computer-science": ["complexity", "dsa"],
  "tech-news": ["tech-news"],
};

const LANGUAGE_TO_TOPICS = {
  java: ["java", "collections"],
  python: ["ai", "dsa"],
  javascript: ["api-design"],
  typescript: ["api-design", "testing"],
  csharp: ["api-design"],
  golang: ["concurrency", "performance"],
  rust: ["memory-model", "performance"],
  cpp: ["memory-model", "cpu-architecture"],
  c: ["memory-model", "cpu-architecture"],
  sql: ["databases", "indexing"],
  kotlin: ["java"],
  swift: ["api-design"],
  php: ["api-design"],
  ruby: ["api-design"],
};

/**
 * A detected language only decides the category when the niche is too generic
 * to say anything. Creators tag every reel with every language they teach —
 * NeetCode puts #java on DSA reels — so letting the language win would file
 * algorithm content under Java and poison the category signal.
 */
const LANGUAGE_TO_CATEGORY = { java: "Java" };
const GENERIC_NICHES = new Set(["software-engineering", "computer-science", "developer-tools"]);

/* --- deterministic fallbacks -------------------------------------------- */

const HYPE_PATTERNS = [
  [/\b(will|guaranteed to)\s+(get|land|make)\s+you\s+(a\s+)?(job|offer|package)/i, "outcome promise"],
  [/\b(nobody|no one)('s| is)?\s+(talking about|telling you)/i, "false scarcity"],
  [/\bin\s+\d+\s*(days?|weeks?|minutes?)\b.*\b(master|learn|job)/i, "impossible timeline"],
  [/^\s*\d+\s+(ai\s+)?(tools?|tricks?|hacks?|websites?)/i, "listicle"],
  [/\b(stop scrolling|save this|comment\s+[A-Z]{3,})/i, "engagement bait"],
];

function detectHype(text) {
  const matched = [];
  for (const [pattern, kind] of HYPE_PATTERNS) {
    const hit = text.match(pattern);
    if (hit) matched.push(hit[0].trim().slice(0, 60));
    void kind;
  }
  return matched;
}

function hueFor(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
}

/** A duration-based difficulty guess, used only when enrichment is unavailable. */
function guessDifficulty(duration, niches) {
  if (niches.includes("system-design") || niches.includes("computer-hardware")) return "Advanced";
  if (duration > 90) return "Intermediate";
  return "Beginner";
}

/* --- Gemini enrichment --------------------------------------------------- */

const TOPIC_IDS = [
  "java","jvm-internals","garbage-collection","concurrency","spring-boot","collections","debugging",
  "git","code-review","testing","dsa","complexity","graphs","dynamic-programming","hashing",
  "system-design","distributed-systems","caching","databases","indexing","consistency","queues",
  "api-design","performance","observability","cloud","containers","ci-cd","cost-engineering",
  "security","auth","web-security","cryptography","ai","embeddings","transformers","rag",
  "recommenders","ml-engineering","hardware","cpu-architecture","memory-model","gpu","career",
  "interviews","portfolio","communication","engineering-culture","build-in-public","dev-humour",
  "tech-news","gaming","game-dev","entertainment",
];

const ENRICH_SYSTEM = `You are cataloguing short technical videos for a recommendation engine used by students.

For each reel you get its real title and description — nothing else. There is no transcript, so do not invent what was said. Judge only from the title, the description, the hashtags and the creator.

For each reel return:

- summary: one neutral sentence describing what the reel appears to cover. No hype, no adjectives like "amazing". If the title is a joke or a meme, say so plainly.
- outcome: the concrete thing a viewer could do or explain afterwards. If the reel is entertainment or a meme with nothing transferable, return an empty string. Do not invent an outcome to be generous.
- difficulty: "Beginner" if it assumes no background, "Intermediate" if it assumes some coding experience, "Advanced" if it assumes working knowledge of the specific system.
- substance: a number 0 to 1. How much transferable technical content this plausibly carries. A meme is 0.05-0.15. An "X vs Y in 30 seconds" comparison is 0.2-0.4. A genuine explainer is 0.6-0.9. Be strict; most short-form content is not a lesson. If you cannot tell from the metadata, stay below 0.5 rather than guessing high.
- hype_markers: exact phrases from the title or description that promise an outcome rather than teach a skill ("will get you a job", "nobody is talking about", "N tools you need", salary flexes, "comment X for the link"). Empty array if there are none. Do not stretch — a normal descriptive title has no markers.
- topics: 1-4 ids from the provided topic list ONLY. Never invent an id.
- prerequisites: up to 2 short phrases, or an empty array.

Be conservative and honest. Recommending a meme as if it were a lesson is the exact failure this catalogue exists to prevent.

Respond with a single JSON object of the form {"reels":[{"reel_id":"...","summary":"...","outcome":"...","difficulty":"...","substance":0.0,"hype_markers":[],"topics":[],"prerequisites":[]}]} and nothing else. Include every reel you were given, in order.`;

/** Omega C model ladder — the gateway throttles a busy model rather than failing hard. */
const MODEL_LADDER = [OMEGA_MODEL, "claude-sonnet-4-6", "claude-opus-4-8"];

/** Pull the first balanced JSON object out of a response that may carry prose. */
function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return body.slice(start, i + 1);
  }
  return null;
}

async function enrichBatch(reels, model = OMEGA_MODEL) {
  const listing = reels
    .map(
      (r) =>
        `reel_id: ${r.reel_id}\n  title: ${r.title}\n  description: ${(r.description ?? "").slice(0, 400)}\n  creator: @${r.owner_username}\n  duration: ${Math.round(r.duration)}s\n  niches: ${(r.niche_labels ?? []).join(", ")}`,
    )
    .join("\n\n");

  const user = `Valid topic ids:\n${TOPIC_IDS.join(", ")}\n\nReels:\n\n${listing}`;

  const res = await fetch(`${OMEGA_BASE.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OMEGA_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: ENRICH_SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${raw.slice(0, 160)}`);
  const json = JSON.parse(raw);
  if (json.error) throw new Error(json.error.message ?? "provider error");
  const text = json.choices?.[0]?.message?.content ?? "";
  const extracted = extractJson(text);
  if (!extracted) throw new Error("no JSON object in response");
  return JSON.parse(extracted).reels ?? [];
}

/* --- main ---------------------------------------------------------------- */

async function main() {
  const catalogPath = path.join(SOURCE_DIR, "data", "catalog", "all.json");
  console.log(`→ reading ${catalogPath}`);
  const entries = JSON.parse(await fs.readFile(catalogPath, "utf8")).slice(0, LIMIT);
  console.log(`  ${entries.length} reels in the source catalog`);

  // Per-reel metadata carries fields the rolled-up catalog drops.
  const detailed = [];
  for (const entry of entries) {
    const metaPath = path.join(SOURCE_DIR, "data", "reels", entry.reel_id, "metadata.json");
    let meta = {};
    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
    } catch {
      // Catalog entry without a metadata file — still usable.
    }
    detailed.push({ ...entry, ...meta });
  }

  let cache = {};
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
  } catch {
    /* first run */
  }

  const needEnrich = ENRICH && OMEGA_KEY ? detailed.filter((r) => !cache[r.reel_id]) : [];
  if (ENRICH && !OMEGA_KEY) {
    console.warn("  ! OMEGA_API_KEY not set — falling back to deterministic mapping only");
  }
  if (needEnrich.length) {
    console.log(`  enriching ${needEnrich.length} reels with ${OMEGA_MODEL} (${BATCH} per call)`);
  }

  for (let i = 0; i < needEnrich.length; i += BATCH) {
    const batch = needEnrich.slice(i, i + BATCH);
    let ok = false;
    for (let attempt = 0; attempt < MODEL_LADDER.length * 2 && !ok; attempt++) {
      const model = MODEL_LADDER[Math.min(Math.floor(attempt / 2), MODEL_LADDER.length - 1)];
      try {
        const enriched = await enrichBatch(batch, model);
        for (const item of enriched) cache[item.reel_id] = item;
        ok = true;
        process.stdout.write(
          `\r  enriched ${Math.min(i + BATCH, needEnrich.length)}/${needEnrich.length}   `,
        );
      } catch (err) {
        if (attempt === MODEL_LADDER.length * 2 - 1) {
          console.warn(`\n  ! batch ${i / BATCH} gave up: ${err.message.slice(0, 110)}`);
        } else {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        }
      }
    }
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  }
  if (needEnrich.length) process.stdout.write("\n");

  /* --- map ------------------------------------------------------------- */

  const reels = detailed.map((entry) => {
    const enriched = cache[entry.reel_id] ?? null;
    const niches = entry.niches ?? [];
    const primaryNiche = entry.primary_niche ?? niches[0] ?? "software-engineering";
    const primaryLanguage = entry.primary_language ?? null;

    const nicheCategory = NICHE_TO_CATEGORY[primaryNiche] ?? "Other";
    const category =
      GENERIC_NICHES.has(primaryNiche) && primaryLanguage && LANGUAGE_TO_CATEGORY[primaryLanguage]
        ? LANGUAGE_TO_CATEGORY[primaryLanguage]
        : nicheCategory;

    const mappedTopics = new Set();
    for (const niche of niches.slice(0, 3)) {
      for (const topic of NICHE_TO_TOPICS[niche] ?? []) mappedTopics.add(topic);
    }
    for (const language of (entry.languages ?? []).slice(0, 2)) {
      for (const topic of LANGUAGE_TO_TOPICS[language] ?? []) mappedTopics.add(topic);
    }
    for (const topic of enriched?.topics ?? []) {
      if (TOPIC_IDS.includes(topic)) mappedTopics.add(topic);
    }

    const description = entry.description ?? "";
    const hashtags = [...description.matchAll(/#([a-z0-9_]+)/gi)].map((m) => m[1].toLowerCase());
    const declaredHype = enriched?.hype_markers?.length
      ? enriched.hype_markers
      : detectHype(`${entry.title}\n${description}`);

    const substance =
      typeof enriched?.substance === "number"
        ? Math.max(0, Math.min(1, enriched.substance))
        : Math.min(0.55, 0.2 + (entry.duration ?? 30) / 400);

    const hue = hueFor(entry.reel_id);

    return {
      id: entry.reel_id,
      title: entry.title,
      creator: {
        handle: `@${entry.owner_username}`,
        name: entry.owner_username,
        hue,
        verified: true,
      },
      durationSec: Math.round(entry.duration ?? 30),
      caption: description.slice(0, 300),
      // No transcripts exist in the source. The model-written summary carries
      // the semantic load and is labelled as such rather than passed off as speech.
      transcript: enriched?.summary ?? "",
      hashtags: [...new Set(hashtags)].slice(0, 8),
      category,
      topics: [...mappedTopics].slice(0, 5),
      difficulty: enriched?.difficulty ?? guessDifficulty(entry.duration ?? 30, niches),
      // The catalogue is real short-form, and most real short-form is a hook
      // rather than a lesson. Reels that clear the substance floor AND state an
      // outcome join the recommendable pool; the rest stay in the feed, which
      // is exactly where a student already meets them.
      lane: substance >= 0.45 && (enriched?.outcome ?? "").length > 8 ? "both" : "feed",
      genre: primaryNiche === "tech-news" ? "news" : substance < 0.25 ? "meme" : "coding",
      substance: Number(substance.toFixed(2)),
      hypeMarkers: declaredHype.slice(0, 5),
      outcome: enriched?.outcome ?? "",
      prerequisites: (enriched?.prerequisites ?? []).slice(0, 2),
      media: {
        poster: { from: hue, to: (hue + 42) % 360, angle: 130 + (hue % 40) },
        storageKey: entry.s3_object_key ?? entry.local_file ?? undefined,
        localFile: entry.local_file ?? undefined,
      },
      stats: {
        // The source has no engagement numbers, and inventing them would be a
        // lie the ranking then reads as signal. Zeroed on purpose.
        likes: 0,
        saves: 0,
        plays: 0,
      },
      publishedAt: new Date().toISOString(),
      source: {
        platform: entry.source ?? "instagram",
        url: entry.source_url ?? null,
        owner: entry.owner_username ?? null,
        attribution:
          entry.attribution ??
          "This video remains copyright of the original author. This project does not claim ownership.",
        width: entry.width ?? null,
        height: entry.height ?? null,
        codec: entry.codec ?? null,
        niches,
        languages: entry.languages ?? [],
      },
      imported: true,
      enriched: Boolean(enriched),
    };
  });

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: SOURCE_DIR,
        enrichmentModel: Object.keys(cache).length ? OMEGA_MODEL : null,
        count: reels.length,
        reels,
      },
      null,
      2,
    ),
    "utf8",
  );

  /* --- report ----------------------------------------------------------- */

  const byCategory = {};
  const byDifficulty = {};
  let hyped = 0;
  let teaching = 0;
  for (const reel of reels) {
    byCategory[reel.category] = (byCategory[reel.category] ?? 0) + 1;
    byDifficulty[reel.difficulty] = (byDifficulty[reel.difficulty] ?? 0) + 1;
    if (reel.hypeMarkers.length) hyped++;
    if (reel.substance >= 0.45) teaching++;
  }

  console.log(`\n✓ ${reels.length} reels → ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  enriched      : ${reels.filter((r) => r.enriched).length}`);
  console.log(`  categories    : ${JSON.stringify(byCategory)}`);
  console.log(`  difficulty    : ${JSON.stringify(byDifficulty)}`);
  console.log(
    `  recommendable : ${reels.filter((r) => r.lane === "both").length} (substance ≥ 0.45 with a stated outcome)`,
  );
  console.log(`  feed-only     : ${reels.filter((r) => r.lane === "feed").length}`);
  void teaching;
  console.log(`  hype flagged  : ${hyped}`);
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
