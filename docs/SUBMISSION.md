# PromptWars X — Submission Pack

Submission requirements, organizer rules, and evaluation alignment for **Upstream** (PromptWars X / Rgmcet).

**Live demo (Railway):** https://upstream-web-production.up.railway.app  
**Primary docs:** [DEPLOYMENT.md](./DEPLOYMENT.md) · [RAILWAY.md](./RAILWAY.md)

---

## 1. Before You Begin

Complete these prerequisites **before** you start building or submitting:

| Prerequisite | Status / action |
| --- | --- |
| **AI platform installed and configured** | This project uses **[Google AI Studio](https://aistudio.google.com)** for `text-embedding-004` embeddings. Create an API key and set `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) in `.env.local`. Optional: [Antigravity](https://antigravity.google) IDE for build day. |
| **Git installed and configured** | `git --version` works; `user.name` and `user.email` are set (`git config --global user.name` / `user.email`). |
| **Active GitHub account** | You can sign in at [github.com](https://github.com). |
| **Public repository management** | You can create a **public** repo, push code, and confirm visibility under **Settings → General → Change repository visibility**. |

**Local smoke test (5 minutes):**

```bash
cd upstream
npm install
cp .env.example .env.local   # if present; otherwise create .env.local
# Add GOOGLE_API_KEY=... from aistudio.google.com
npm run dev
# Open http://localhost:3000 — sign up → onboarding → feed
```

---

## 2. Important Rules

Failure to follow these rules may result in your submission **not being evaluated**.

| Rule | Requirement |
| --- | --- |
| **Attempts** | **Maximum 2 attempts** allowed on the platform. Only your **last successful submission** counts for scoring. |
| **Repository size** | GitHub repository must be **less than 10 MB**. Do **not** commit `node_modules/`, `.next/`, video files, or large generated assets. Use `.gitignore` (included in this repo). |
| **Visibility** | Repository must be **public**. |
| **Branches** | Repository must contain **only one branch** (typically `main`). Delete or avoid extra long-lived branches before submit. |
| **Deploy (Top 10)** | **Top 10** finalists need a **working deployed link** (Cloud Run recommended for PromptWars; Railway acceptable for demos). A broken deploy can disqualify you even with a high score. |

**Keep repo under 10 MB — do not commit:**

- `node_modules/`, `.next/`, `out/`
- `.env`, `.env*.local` (secrets)
- `/public/media/hls`, uploaded MP4s, ingest video folders
- `data/generated/runtime.json` (local session snapshot)

**Check size before push:**

```bash
git count-objects -vH
du -sh . --exclude=node_modules --exclude=.next
```

---

## 3. Challenge Expectations

Your solution should demonstrate:

| Expectation | How Upstream delivers it |
| --- | --- |
| **Smart, dynamic assistant** | `/agent` “For you” — reads watch history, runs retrieval + hype guardrails, recommends the next teachable reel with a visible trace. |
| **Logical decisions from user context** | Taste profile from likes, saves, watch time, skips, and dislike reasons; feed re-ranks after ~3 likes; onboarding clusters seed the first feed. |
| **Practical, real-world usability** | Full E2E: signup → onboarding → feed / reels / explore / profile / create — deployed on Railway with S3-backed video playback. |
| **Clean, maintainable code** | TypeScript strict mode, focused modules (`lib/feed`, `lib/agent`, `lib/store`), Zod validation, `npm run verify` gate. |

**Challenge vertical:** Choose **one persona** from the organizer deck and design around it. Upstream targets:

> **Student / learner scrolling short-form content** — the agent infers *why* they watch (career orientation, DSA prep, etc.) and redirects toward catalog reels with a **checkable outcome**, not keyword clones or hype listicles.

Demo the trap contrast: shallow keyword feed at `/trap` vs Upstream feed at `/feed` and agent at `/agent`.

---

## 4. How to Work on Your Project

### Step A — Repository setup (single branch, public)

1. Create a **new public** GitHub repository (empty, no README if you prefer a clean history).
2. From the **`upstream/`** folder in this project (submit **this app only**, not the whole monorepo):

```bash
cd upstream
git init
git branch -M main
git add .
git commit -m "Initial Upstream submission"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

3. Confirm: **one branch** (`main`), **public**, size **< 10 MB** on GitHub.

### Step B — Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_API_KEY` | Yes (for embeddings) | Google AI Studio — semantic search & feed |
| `AUTH_SECRET` | Yes (production) | Session cookies survive restarts |
| `DATABASE_URL` | Optional | Postgres persistence (Railway) |
| `QDRANT_URL` / `QDRANT_API_KEY` | Optional | External vector store at scale |
| S3 vars | Optional | Video storage (see [RAILWAY.md](./RAILWAY.md)) |

### Step C — Develop locally

```bash
npm run dev          # http://localhost:3000
npm run verify       # typecheck + lint + tests + build
npm run agent:eval   # agent integration (server running)
```

**Suggested flow to test:** Sign up → complete onboarding → like 3 reels on feed → open For you → confirm taste-based suggestions update.

### Step D — Deploy

- **PromptWars / Top 10:** [DEPLOYMENT.md](./DEPLOYMENT.md) — **Google Cloud Run**
- **Hackathon demo:** [RAILWAY.md](./RAILWAY.md) — Postgres + Qdrant + S3 on Railway

After deploy:

```bash
curl https://<your-deploy-url>/api/health
```

Expect `{ "ok": true, ... }`.

### Step E — Platform submission (fill all four fields)

| # | Field | Your link |
| --- | --- | --- |
| **1/4** | Public GitHub repository | `https://github.com/<your-username>/<repo-name>` |
| **2/4** | Repository is public | Settings → General → Public |
| **3/4** | Deployed project URL | Cloud Run or Railway URL |
| **4/4** | Project description | See below |

**Project description (copy/adapt for platform):**

> **Upstream** is an Instagram-style learning feed where students sign up, scroll reels, and get redirected toward **technical content worth their next sixty seconds**. Unlike keyword recommenders, Upstream reads **why** you watched — watch time, saves, likes, skips — and recommends catalog reels that teach a **checkable skill**. A hype guardrail blocks listicles before ranking. Stack: Next.js · TypeScript · Google `text-embedding-004` · optional Qdrant · deployed full E2E (feed, reels, explore, profile, create, AI For you).

### Step F — Before each attempt

```bash
npm run verify
curl https://<deploy>/api/health
```

- [ ] Repo public, **single branch**, **< 10 MB**
- [ ] Deploy live and health check passes
- [ ] Attempt count ≤ **2**

---

## Evaluation framework alignment

| Parameter | How Upstream addresses it |
| --- | --- |
| **Code quality** | TypeScript strict, ESLint, `npm run typecheck`, modular `lib/` layout |
| **Security** | scrypt passwords, HMAC sessions, rate limits, Zod on APIs, CSP headers |
| **Efficiency** | Feed rank cache, lazy `hls.js`, debounced store writes, MMR retrieval |
| **Testing** | `npm test` + `npm run agent:eval` + `npm run verify` |
| **Accessibility** | Skip link, focus traps, ARIA on feed controls, reduced-motion CSS |
| **Problem alignment** | `/trap` vs `/feed`, live trace at `/agent`, taste at `/profile` |
| **Google services** | **Google AI Studio** `text-embedding-004`; **Google Fonts** via `next/font` |

---

## Leaderboard & event reference

- Only the **last submitted attempt** counts.
- **Challenge:** up to **2** scored submissions; one **retry** only for platform / connectivity failures (not after a successful eval).
- **Top 10** must present a **working deploy**.

| Block | Time |
| --- | --- |
| Registration | 9:00 – 9:20 |
| Briefing | 9:20 – 9:40 |
| Build phase begins | 9:40 |
| Lunch | 12:30 – 1:20 |
| Evaluation window | 11:00 – 2:30 |
| Top 10 pitching | 3:00 – 3:30 |
| Winners announcement | 3:45 – 4:20 |

---

## Quick verify

```bash
npm run verify
npm run agent:eval
curl https://<deploy>/api/health
```
