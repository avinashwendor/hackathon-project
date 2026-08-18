# Railway deployment

Three services on Railway: **Web app**, **Postgres**, **Qdrant**.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│  Postgres    │     │   Qdrant    │
│  (Upstream) │     │  accounts,   │     │  reel       │
│             │────▶│  events,     │     │  vectors    │
│             │     │  social      │     │  (768d)     │
└─────────────┘     └──────────────┘     └─────────────┘
        │
        ▼
 data/generated/embeddings.*.json  (committed cache — boot-time embed source)
```

---

## 1. Create the Railway project

1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub** → connect `avinashwendor/hackathon-project`
3. Root directory: **`/`** (repo root is the Next.js app)

---

## 2. Add Postgres

1. Project → **+ New** → **Database** → **PostgreSQL**
2. Click the Postgres service → **Connect** → copy `DATABASE_URL`
3. On the **Web** service → **Variables** → **Add Reference** → select Postgres `DATABASE_URL`
4. Open Postgres → **Data** → **Query** and paste the contents of:

   ```
   migrations/001_init.sql
   ```

   Run it once. (Do not skip — tables must exist before the app serves traffic.)

---

## 3. Add Qdrant (vector DB)

1. Project → **+ New** → **Template** → search **Qdrant**
2. Deploy the Qdrant template
3. Copy the public/internal URL (e.g. `https://xxx.up.railway.app` or internal hostname)
4. On the **Web** service, set:

   ```
   VECTOR_DRIVER=qdrant
   QDRANT_URL=https://your-qdrant-service.up.railway.app
   QDRANT_API_KEY=          # if the template sets one
   QDRANT_COLLECTION=upstream_reels
   ```

---

## 4. Web service variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Reference from Postgres plugin |
| `AUTH_SECRET` | **Yes** | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Your Railway web URL |
| `GEMINI_API_KEY` | Recommended | [aistudio.google.com](https://aistudio.google.com) — embeddings + scoring |
| `QDRANT_URL` | Recommended | From Qdrant service |
| `VECTOR_DRIVER` | Recommended | `qdrant` when Qdrant is linked |
| `OMEGA_API_KEY` | Optional | Full LLM agent path |

`railway.toml` is already configured:

- Build: `npm run build`
- Start: `npm run start`
- Health: `/api/health`

---

## Where data lives

### Embeddings (semantic vectors)

| Layer | Location | Purpose |
| --- | --- | --- |
| **Cache** | `data/generated/embeddings.google-gemini-embedding-001.json` | Pre-computed 768d vectors for every catalog reel. Shipped in the repo so Railway boot does not re-call Google for 250+ reels. |
| **Provider** | Google `gemini-embedding-001` via `GEMINI_API_KEY` | Used when cache misses (new/edited reels). Rate-limited to ~90 req/min. |
| **Fallback** | `local:hybrid-v2` (384d) | Deterministic, no API key. Used locally without Gemini. |

Build flow (`lib/vector/index.ts`):

1. Load reel corpus from `data/reels.ts`
2. Read disk cache keyed by provider + document hash
3. Embed only cache misses via Google or local provider
4. Write updated cache back to `data/generated/` (best-effort on Railway)

### Vector search (similarity index)

| Driver | When | Storage |
| --- | --- | --- |
| **Qdrant** | `QDRANT_URL` set | Collection `upstream_reels`, cosine distance, 768d |
| **Memory** | No Qdrant | In-process — rebuilt each cold start from cache |

On boot, all cached vectors are **upserted into Qdrant**. Search, agent retrieval, and `/api/search` read from Qdrant when configured.

### Session data (accounts, likes, events)

| Driver | When | Storage |
| --- | --- | --- |
| **Postgres** | `DATABASE_URL` set | Tables in `migrations/001_init.sql` |
| **File** | Local dev | `data/generated/runtime.json` |

Railway **must** use Postgres — the filesystem is ephemeral and accounts would vanish on redeploy.

---

## Verify after deploy

```bash
curl https://YOUR-APP.up.railway.app/api/health
```

Expected shape:

```json
{
  "ok": true,
  "capabilities": {
    "postgres": true,
    "qdrant": true,
    "googleEmbeddings": true
  },
  "storage": {
    "sessionStore": "postgres",
    "postgresOk": true,
    "vectorStore": "qdrant",
    "embeddingProvider": "google:gemini-embedding-001",
    "vectorCount": 250,
    "embeddingsCached": true
  }
}
```

---

## Rebuild embedding cache locally

If you add reels to the catalog:

```bash
GEMINI_API_KEY=... npm run embed
git add data/generated/embeddings.*.json
git commit -m "Refresh embedding cache"
git push
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Signup works then data gone after redeploy | Add Postgres + run `001_init.sql` |
| Agent search feels random | Set `GEMINI_API_KEY` — local 384d ≠ Google 768d cache |
| `vectorFallback` in health | Qdrant URL wrong or collection dim mismatch — check logs |
| `postgresOk: false` | Run migration SQL; verify `DATABASE_URL` reference |
