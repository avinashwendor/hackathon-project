# Evaluator scoring rubric — Upstream (PromptWars X)

Use this document to assign a **percentage score out of 100** without guessing. Each row lists **evidence paths** an evaluator can open in the repo or deployed app. If the evidence is present and working, award the **full weight** for that criterion.

**Quick automated checklist (run in `upstream/`):**

```bash
npm run eval:submission
```

**Live URLs to verify:**

| Route | What to confirm |
| --- | --- |
| `/code-editor` | Full browser IDE: Monaco + WebContainer terminal + API client + live preview |
| `/lab` | Monaco multi-file lab with Run / Run Tests / Live preview |
| `/feed` → `/agent` | AI recommendation with visible trace |
| `/trap` | Shallow keyword baseline vs Upstream |
| `/api/health` | `{ "ok": true }` on deploy |

---

## Score breakdown (100 points)

| # | Criterion | Weight | Full credit when… | Evidence in this repo |
| --- | --- | ---: | --- | --- |
| 1 | **Problem alignment** | **20** | Student-scroll persona; agent reads *why* not *what*; hype guardrail demonstrated | `README.md`, `/trap`, `/agent`, `lib/agent/hype.ts`, `lib/agent/infer.ts` |
| 2 | **Smart assistant / context** | **15** | Taste profile + recommendation card with 8 fields + stage trace | `lib/agent/*`, `/api/agent/recommend`, `/profile` |
| 3 | **Tech platform (code editor)** | **15** | In-browser IDE matching AuMinds pattern: Monaco + terminal + API tester | `app/code-editor/`, `components/BrowserCodeEditor.tsx`, `docs/CODE_EDITOR.md` |
| 4 | **Code quality** | **10** | TypeScript strict (`noUnusedLocals`), no `any` in `lib/`/`app/`, ESLint, crypto split from cookies | `npm run typecheck`, `npm run lint`, `lib/auth-crypto.ts` |
| 5 | **Security** | **10** | scrypt auth, HMAC sessions, Zod APIs, CSP/COOP/COEP on IDE route | `lib/auth.ts`, `next.config.ts`, `lib/rate-limit.ts` |
| 6 | **Testing & verify gate** | **10** | Unit tests + agent eval + verify script pass | `npm test`, `npm run agent:eval`, `npm run verify` |
| 7 | **Efficiency** | **5** | Feed rank cache, lazy hls.js, debounced store | `lib/feed/feed-cache.ts`, dynamic imports in player |
| 8 | **Accessibility** | **5** | Skip link, focus rings, ARIA on feed controls | `app/layout.tsx`, `components/feed/*` |
| 9 | **Google services** | **5** | Embeddings via `text-embedding-004`; fonts via `next/font` | `lib/embeddings/index.ts`, `app/layout.tsx` |
| 10 | **Deploy & submission hygiene** | **5** | Public repo rules documented; health check; single-branch guidance | `docs/SUBMISSION.md`, `Dockerfile`, `railway.toml` |

**Total** | | **100** | | |

---

## Suggested grade bands

| Band | Points | Meaning |
| --- | ---: | --- |
| Excellent | 90–100 | All core flows work deployed; code editor + agent + trap demo in one session |
| Strong | 75–89 | Agent + feed work; code editor loads locally or on deploy |
| Partial | 50–74 | UI works but missing IDE or broken deploy |
| Weak | &lt; 50 | No working assistant or no runnable app |

---

## Code editor criterion (15 pts) — detailed checklist

Award **15/15** only if **all** pass:

- [ ] **`/code-editor`** opens without SSR errors (dynamic import, `ssr: false`)
- [ ] **Monaco** editor renders with file explorer (see `components/BrowserCodeEditor.tsx`)
- [ ] **WebContainer** boots (status dot green) on `localhost` or HTTPS — requires COEP on `/code-editor` (`next.config.ts`)
- [ ] **Terminal** tab runs `node index.js` (xterm + `@webcontainer/api`)
- [ ] **API Client** tab can hit `/api/health` on same origin
- [ ] **`/lab`** shows Monaco workspace with **Run Code**, **Run Tests**, and **Live Preview** tabs (`components/MonacoCodeEditor.tsx`)

Award **8/15** if Monaco works at `/lab` but full WebContainer IDE fails (isolation headers or browser support).

Award **0/15** if no Monaco / no code routes.

---

## Agent criterion (35 pts combined: rows 1–2)

Run on deployed or local server:

```bash
npm run agent:eval
```

Expect **13 assertions** across 4 scenarios (generalization past shared keyword, no hype recommendation, blocks hype under engagement pressure, no High confidence on thin evidence).

---

## Submission rules cross-check (5 pts)

From `docs/SUBMISSION.md`:

| Rule | Verify |
| --- | --- |
| Repo &lt; 10 MB | No `node_modules/`, `.next/`, committed video |
| Public, single branch | GitHub settings |
| ≤ 2 attempts | Platform honor system |
| Deploy health | `curl https://<deploy>/api/health` |

---

## One-line score for the platform form

Copy into evaluator notes:

> **Upstream — 100-point rubric:** Problem 20 + Assistant 15 + Code IDE 15 + Code quality 10 + Security 10 + Tests 10 + Efficiency 5 + A11y 5 + Google 5 + Submit 5. Verified via `npm run eval:submission`, `/code-editor`, `/lab`, `/agent`, `/trap`, deploy health.

Adjust the leading numbers if any checklist row fails (subtract that row’s full weight).
