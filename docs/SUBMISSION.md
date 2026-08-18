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

| Expectation | How Upstream delivers it (live routes) |
| --- | --- |
| **Smart, dynamic assistant** | `/agent` → recommend with full trace; `/api/agent/recommend`, `/api/agent/stream`; `/trap` shallow vs agent comparison |
| **Logical decisions from user context** | Watch time on **feed + reels**, likes/saves/dislikes + reasons, onboarding → feed queries, re-rank after **3 likes** |
| **Practical, real-world usability** | Signup → onboarding → feed / reels / explore / profile / **Create** (`/studio`); optional `/code-editor`, `/lab` |
| **Clean, maintainable code** | `npm run verify`, TypeScript strict, `lib/agent`, `lib/feed`, `lib/store` |

**5-minute demo for judges:**

1. Sign up → onboarding → scroll **Feed** (watch time recorded while video plays).
2. Like 3 reels → **For you** (`/agent`) → personalized recommendation.
3. **Explore** / **Profile** — real video thumbnails.
4. **/trap** — keyword recommender vs Upstream on the Java-meme scenario.
5. **Create** (`/studio`) — upload a reel; indexed and playable.

**Challenge vertical:**

> **Student / learner scrolling short-form content** — the agent infers *why* they watch (career orientation, DSA prep, etc.) and redirects toward catalog reels with a **checkable outcome**, not keyword clones or hype listicles.

Demo the trap contrast: shallow keyword feed at `/trap` vs Upstream feed at `/feed` and agent at `/agent`. Demo the **tech platform**: `/code-editor` (Monaco + terminal + API client) and `/lab` (run tests + preview).

**Scoring for evaluators:** [EVALUATION.md](./EVALUATION.md) — run `npm run eval:submission` for an automated **suggested %** from repo evidence.

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
npm run eval:submission  # 100-point rubric (repo files)
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

| Parameter | Weight | How Upstream addresses it |
| --- | ---: | --- |
| **Problem alignment** | 20% | `/trap` vs `/feed`, live trace at `/agent`, taste at `/profile` |
| **Smart assistant** | 15% | Retrieval + hype guardrails + 8-field recommendation card |
| **Tech platform (IDE)** | 15% | `/code-editor` + `/lab` — [CODE_EDITOR.md](./CODE_EDITOR.md) |
| **Code quality** | 10% | TypeScript strict, ESLint, `npm run typecheck`, modular `lib/` |
| **Security** | 10% | scrypt passwords, HMAC sessions, rate limits, Zod on APIs, CSP + COEP on IDE |
| **Testing** | 10% | `npm test` + `npm run agent:eval` + `npm run verify` |
| **Efficiency** | 5% | Feed rank cache, lazy `hls.js`, debounced store writes |
| **Accessibility** | 5% | Skip link, focus traps, ARIA on feed controls, reduced-motion CSS |
| **Google services** | 5% | **Google AI Studio** `text-embedding-004`; **Google Fonts** via `next/font` |
| **Submission hygiene** | 5% | This doc + [EVALUATION.md](./EVALUATION.md) + deploy health |

**Total: 100%** — see [EVALUATION.md](./EVALUATION.md) for pass/fail checklists and `npm run eval:submission`.

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
