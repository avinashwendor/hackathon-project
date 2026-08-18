# PromptWars X — Submission Pack

Submission requirements and evaluation alignment from the **PromptWars X Organizer Community Deck** (Rgmcet).

---

## Links (fill before submitting on the platform)

| Requirement | Link |
| --- | --- |
| **1/4 — Public GitHub repository** | `https://github.com/<your-username>/upstream` |
| **2/4 — Repository is public** | Settings → General → Change visibility → Public |
| **3/4 — Deployed project (Cloud Run)** | `https://<your-service>-<hash>.run.app` |
| **4/4 — Project description** | See below |

---

## Project description (platform field)

**Upstream** is an Instagram-style short-form feed where students sign up, scroll reels, and get redirected toward **technical content worth their next sixty seconds**.

Unlike keyword recommenders that serve “more Java memes” after one Java meme, Upstream reads **why** you watched — watch time, saves, replays, skips — climbs an abstraction ladder (surface → domain → motivation), and recommends catalog reels that teach a **checkable skill**. A hype guardrail blocks listicles and outcome promises before ranking.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Google `text-embedding-004` · optional Qdrant · scrypt auth · Cloud Run deploy.

**User flow:** Sign up → Home feed (stories + posts) → Reels → Profile → AI agent “For you” recommendations.

---

## Evaluation framework alignment

Platform scoring checks the signals below. This repo maps each one to concrete implementation.

| Parameter | How Upstream addresses it |
| --- | --- |
| **Code quality** | TypeScript strict mode, QueryBuilder-free focused modules, ESLint + `npm run typecheck`, agent eval suite |
| **Security** | CSP + HSTS + frame denial headers, scrypt passwords, HMAC session cookies, rate limits on auth/API, Zod validation |
| **Efficiency** | In-process vector search at demo scale, debounced persistence, lazy `hls.js` import, MMR retrieval, signal decay |
| **Testing** | `npm test` (unit) + `npm run agent:eval` (13 integration assertions) + `npm run verify` full gate |
| **Accessibility** | Skip-to-content link, auth dialog focus trap, ARIA on feed controls, reduced-motion CSS |
| **Problem statement alignment** | Shallow-match trap demo (`/trap`), live agent trace (`/agent`), taste profile (`/profile`) |
| **Google services** | **Google AI Studio** `text-embedding-004` for semantic retrieval; **Google Fonts** via `next/font` |

---

## Leaderboard rules (from deck)

- Only the **last submitted attempt** counts as the final score.
- **Challenge:** up to **2** scored code-assessment submissions.
- One **retry** allowed on connectivity / technical submission failure (not on successful evaluation).
- **Top 10** require a **working Cloud Run deployed link** — broken deploy = disqualification even if leaderboard rank is high.

---

## Event agenda (reference)

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

## Pre-event checklist

- [ ] Install [Antigravity](https://antigravity.google) (optional IDE for build day)
- [ ] Clone this repo and run `npm install && npm run dev`
- [ ] Set `GOOGLE_API_KEY` in `.env.local` (free tier at [aistudio.google.com](https://aistudio.google.com))
- [ ] Deploy to Cloud Run — see [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ ] Confirm `/api/health` returns `{ ok: true }` on the live URL
- [ ] Run `npm run verify` before each platform submission
- [ ] Submit **public GitHub URL + live deploy URL + description** on the platform

---

## Verify before submit

```bash
npm run verify          # typecheck + lint + unit tests + build
npm run agent:eval      # agent integration checks (server must be running)
curl https://<deploy>/api/health
```
