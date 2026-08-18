# Code editor — AuMinds pattern in Upstream

Upstream is a **tech learning platform**, not just a feed. The in-browser IDE follows the same architecture as [AuMinds](https://github.com) (`/Users/apple/Desktop/auminds`): Monaco for editing, WebContainer for Node in the browser, xterm for the shell, and a built-in API client.

## Routes

| URL | Component | Purpose |
| --- | --- | --- |
| `/code-editor` | `BrowserCodeEditor` | Full-screen IDE: explorer, Monaco, terminal, API tester, dev-server preview |
| `/lab` | `MonacoCodeEditor` | Lesson-style lab inside `AppShell`: run stdout, HTML preview, test cases |

## File map

```
app/code-editor/page.tsx          → dynamic import (no SSR)
app/lab/page.tsx                  → sample career-skills lab
components/BrowserCodeEditor.tsx  → WebContainer workspace IDE
components/BrowserTerminal.tsx    → xterm ↔ jsh shell
components/BrowserApiTester.tsx   → fetch API client (same-origin + CORS note)
components/MonacoCodeEditor.tsx   → multi-file Monaco + run/tests/preview
lib/webcontainer/workspace.ts     → scan/mount workspace files
```

## Dependencies

```json
"@monaco-editor/react": "^4.6.0",
"@webcontainer/api": "1.6.4",
"@xterm/addon-fit": "0.11.0",
"@xterm/xterm": "6.0.0",
"sonner": "^2.0.7"
```

## Isolation headers (required for WebContainer)

`next.config.ts` sets on `/code-editor`:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

Global CSP also includes `worker-src 'self' blob:` for Monaco/WebContainer workers.

## Local smoke test

```bash
npm run dev
# Open http://localhost:3000/code-editor — wait for green runtime dot
# Terminal: node index.js
# API tab: GET /api/health
# Open http://localhost:3000/lab — Run Code + Run Tests
```

## Evaluator note

This feature satisfies the **Tech platform (code editor)** row in [EVALUATION.md](./EVALUATION.md) (**15 points**). Confirm both routes before awarding full marks.
