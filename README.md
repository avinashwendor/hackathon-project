# Upstream

**An AI recommendation agent that reads *why* a student watched, not *what* they watched.**

Instagram-style signup → home feed → reels → profile. The agent infers interest underneath the scroll and points the next sixty seconds at technical content worth your time.

---

## PromptWars submission

| Field | Value |
| --- | --- |
| **GitHub (public)** | Set after push — see [docs/SUBMISSION.md](./docs/SUBMISSION.md) |
| **Deployed (Cloud Run)** | Deploy with [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| **Description** | Instagram-style learning feed with AI that reads *why* you watched, not keywords. Sign up → scroll reels → get redirected to teachable technical content. Uses Google `text-embedding-004`, hype guardrails, and a full agent trace. |

Full checklist: **[docs/SUBMISSION.md](./docs/SUBMISSION.md)**  
Railway (Postgres + Qdrant): **[docs/RAILWAY.md](./docs/RAILWAY.md)**

```bash
npm run verify          # typecheck + lint + tests + build
npm run agent:eval      # 13 agent assertions (server running)
```

---

Students are going to scroll either way. Upstream does not try to stop them — it works out the
interest underneath the feed and points the next sixty seconds at something that leaves them able
to do a thing they could not do before.

```
* CURRENT REEL: Java asking if you're SURE you want a String (@stacktrace.jpg, Java)
* INTEREST DETECTED: Becoming a hireable software engineer
* WHY: saved "Day in the life — SDE-2"; re-watched an interview joke 1.8×; saved a laptop
  comparison. The four reels share no vocabulary — they share a vantage point.
* RECOMMENDED TECH REEL: Rewrite one resume bullet with me
* CATEGORY: Career
* WHY THIS RECOMMENDATION: They are assembling a picture of what getting hired asks of them.
  This teaches one checkable skill instead of promising an outcome.
* DIFFICULTY: Beginner
* CONFIDENCE: High
```

That is real output, produced live. The student watched a Java meme. The agent did not recommend
another Java meme.

---

## The two traps, and how each is handled

### 1. The shallow-match trap

A student watches a Java meme, a software-engineer day-in-the-life, a coding interview joke and a
laptop comparison. The only literal overlap is the word *Java* — and the laptop reel does not even
have that. Keyword overlap serves another Java meme.

Upstream climbs an **abstraction ladder** before it retrieves anything:

| Rung | For this history |
| --- | --- |
| Surface | "Java", "memes", "laptops" — what the reels literally are |
| Domain | Software engineering craft — what contains all four |
| Motivation | Orienting toward a first engineering job — why a person watches *this set*, this week |

Two mechanisms make the climb, and either one alone gets the trap right:

- **Ontology walk** (`data/ontology.ts`) — every topic declares its domain and the motivation it
  usually serves, so four narrow topics resolve to one broad interest. Deterministic, no model.
- **LLM inference** (`lib/agent/infer.ts`) — reads nuance the ontology cannot encode. The prompt
  states the failure as a prohibition: *if four reels share one keyword and nothing else, the
  keyword is a coincidence of vocabulary, not an interest.*

`breadthDetected` then hard-blocks any candidate whose only connection is the current reel's exact
subtopic. That is the trap, closed by a rule rather than by hope.

### 2. The hype trap

"10 AI tools that will get you a job in 2026" wins every engagement metric there is. An
engagement-ranked feed serves it first, every time.

So the guardrail (`lib/agent/hype.ts`) runs **deliberately against popularity**, and it runs
**before ranking** — a reel that trips it never reaches the shortlist:

- A 15-pattern lexicon covering outcome promises, salary flex, impossible timelines, false scarcity,
  conspiracy framing, engagement bait and listicle shape.
- A substance floor: below 0.45 a reel is refused even if it is perfectly honest.
- The LLM reranker's pick is **re-checked** afterwards. A model that argues itself into a listicle
  loses that argument.

The most-played reel in the catalog (11.2M plays) is the one the filter blocks hardest. That is the
point.

---

## Architecture

```
signals → taste vector → inference → retrieval → guardrails → rerank → card
```

| Stage | File | What it does |
| --- | --- | --- |
| Signals | `lib/agent/signals.ts` | Watch time, replays, saves, and the two-second skip. Weighted, with a 4-hour decay half-life. A save outranks a like; an early skip is a real negative, not missing data. |
| Taste | `lib/agent/taste.ts` | Centroid of what held attention, **minus** what was pushed away. Plus symbolic facets, category pull and a difficulty lean read from completion. |
| Inference | `lib/agent/infer.ts` | The ladder climb. LLM path with a deterministic ontology fallback that also solves the trap. |
| Retrieval | `lib/agent/retrieve.ts` | Five parallel queries (interest, motivation, adjacents, a capability query, the taste centroid), fused by best score, then MMR-diversified. |
| Guardrails | `lib/agent/hype.ts` | Hype, substance floor, same-subtopic, difficulty mismatch, already-seen. |
| Rerank | `lib/agent/rerank.ts` | Closeness is solved by here. This answers "which is worth 60 seconds?" |
| Output | `lib/agent/format.ts` | The eight required fields, from the same object the UI renders. |

Every run returns its stages, its rejected candidates with reasons, its evidence and its
diagnostics. A recommendation you cannot interrogate is just another black box, which is the thing
this is meant to be an answer to.

### Providers — everything degrades

The app boots and demos correctly with **zero secrets set**. Each provider reports what it is doing
in `diagnostics`, rather than pretending.

| Concern | Configured | Not configured |
| --- | --- | --- |
| LLM | Omega C (`claude-sonnet-4-6`), OpenAI-compatible, streamed | Deterministic ontology walk + retrieval-score ranking |
| Embeddings | Google `text-embedding-004`, free tier, 768d | `local:hybrid-v2` — 384d hashed n-grams + explicit ontology/category/difficulty slots, with light stemming |
| Vector store | Qdrant (REST, no SDK) | In-process exhaustive cosine — sub-millisecond at this corpus size |
| Media | S3 / R2 / MinIO via presigned PUT | Generated CSS posters; local dev sink |

---

## Running it

```bash
npm install
cp .env.example .env.local     # set AUTH_SECRET for production deploys
npm run dev
```

**App routes (signed-in):** `/feed` home · `/reels` vertical player · `/explore` grid · `/profile` · `/agent` console · `/trap` shallow vs Upstream · `/library` search · `/studio` ingest

**Auth:** `/signup` · `/login` · `/about` product pitch (public)

### Proving it works

```bash
npm run build && npm start
npm run agent:eval          # 13 assertions across 4 scenarios
```

The eval asserts the properties that actually matter — generalises past the shared keyword, never
recommends hype, blocks at least one hype candidate under engagement pressure, and refuses to claim
High confidence on thin evidence.

### Adaptive streaming

```bash
npm run transcode -- --input reel.mp4 --id my-reel --upload
```

Builds a four-rung HLS ladder (1080/720/480/360, 4-second segments, keyframe-aligned so the player
can actually switch), writes `master.m3u8`, and optionally uploads to S3 with immutable cache
headers on segments. Playback is native HLS on Safari and `hls.js` elsewhere, loaded dynamically so
a feed with no real media never downloads it.

---

## API

| Route | Purpose |
| --- | --- |
| `POST /api/agent/recommend` | The full pipeline. `{ scenarioId }` or `{ currentReelId, events }`. |
| `POST /api/agent/stream` | Same, as SSE — stages arrive as they happen. |
| `POST /api/agent/compare` | Runs the shallow baseline and the agent over one history. |
| `GET /api/search?q=` | Semantic search, with the guardrail verdict on each hit. |
| `POST /api/events` | Append interactions, returns the updated profile. |
| `GET /api/profile` | Everything the system believes. `DELETE /api/events` wipes it. |
| `POST /api/upload/sign` → `complete` | Presigned upload, then embed + index. |
| `GET /api/health` | Which providers are live, and what the index looks like. |

---

## Deploying

### Cloud Run (PromptWars Top 10)

See **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — Dockerfile included, health check at `/api/health`.

### Railway

1. Push the repo, create a Railway service from it. `railway.toml` is already here — Nixpacks
   builds with `npm run build` and starts with `npm start`, health-checked at `/api/health`.
2. Set variables (all optional, but the agent is better with the first two):

   ```
   OMEGA_API_KEY=...
   GOOGLE_API_KEY=...          # free tier at aistudio.google.com
   QDRANT_URL / QDRANT_API_KEY # Railway Qdrant template, or Qdrant Cloud
   S3_BUCKET / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
   NEXT_PUBLIC_APP_URL=https://<your-app>.up.railway.app
   ```

3. `curl https://<app>/api/health` to confirm which paths are live.

Note: the session store is in-process with a JSON snapshot. On Railway's ephemeral filesystem a
restart clears demo sessions — correct for a scroll session, and `lib/store/index.ts` is a single
narrow interface if you want Postgres behind it.

---

## Design

The reference design system is implemented in `app/globals.css` as Tailwind v4 `@theme` tokens, with
one deliberate extension: **two worlds, one system.** Paper is where the product reasons — warm
canvas `#FBF8F5`, Playfair headings, hairline rules. Ink is where reels play — the same orange on an
inverted ground, applied by adding `.theme-ink` to any subtree. Components consume semantic tokens
(`bg-surface`, `text-fg`, `border-line`), so a single class flips a whole subtree. See
`/design-system`.

Reels, creators and engagement numbers in this build are fictional.
