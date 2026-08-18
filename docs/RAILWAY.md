# Railway deployment

Four pieces on Railway: **Web app**, **Postgres**, **Qdrant**, **S3 (or R2)** for reel video.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│  Postgres    │     │   Qdrant    │
│  (Upstream) │     │  accounts,   │     │  reel       │
│             │────▶│  events,     │     │  vectors    │
│             │     │  social      │     │  (768d)     │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       ├────▶ S3 / R2  (192 MP4s — keys in catalog.json)
       │
       └────▶ data/generated/embeddings.*.json  (committed cache)
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
| `S3_BUCKET` | **Yes for video** | Reel MP4 storage |
| `S3_PUBLIC_BASE_URL` | **Yes for video** | Public CDN URL prefix for MP4s |
| `S3_ACCESS_KEY_ID` | **Yes for video** | S3/R2 credentials |
| `S3_SECRET_ACCESS_KEY` | **Yes for video** | S3/R2 credentials |
| `STORAGE_DRIVER` | Recommended | `s3` when bucket is configured |
| `OMEGA_API_KEY` | Optional | Full LLM agent path |

`railway.toml` is already configured:

- Build: Docker (`Dockerfile`, standalone output)
- Start: `node server.js` (standalone — do not use `next start` in production)
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

### Reel video (S3 / Cloudflare R2)

| Layer | Location | Purpose |
| --- | --- | --- |
| **Metadata** | `data/generated/catalog.json` | 192 imported reels, each with `media.storageKey` |
| **Files** | S3 bucket (not in git) | MP4s at keys like `reels/reel_000001/foo.mp4` |
| **Playback URL** | `S3_PUBLIC_BASE_URL` + key | Resolved at runtime in `lib/media.ts` |

Embeddings are **already done** — 253 vectors ship in `data/generated/embeddings.google-gemini-embedding-001.json`. You do **not** need to re-embed on Railway.

Videos are **not** in the repo. Without S3, reels show CSS posters only.

#### Recommended: Cloudflare R2 (S3-compatible, free egress)

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket** (e.g. `upstream-reels`)
2. **Manage R2 API tokens** → create token with Object Read & Write
3. Enable **Public access** on the bucket (R2.dev subdomain or custom domain)
4. Note: Account ID, Access Key, Secret, public URL

On Railway Web service:

```
STORAGE_DRIVER=s3
S3_BUCKET=upstream-reels
S3_REGION=auto
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret>
S3_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
```

#### Upload catalog MP4s (run once from your laptop)

Your ingest output lives at the path recorded in `catalog.json` (`sourceDir`, typically `~/Desktop/short videso`):

```bash
cd upstream
cp .env.example .env.local   # fill S3_* vars

# Dry run — see what would upload
npm run sync:s3 -- --dir "/Users/apple/Desktop/short videso" --dry-run

# Upload all 192 reels (skips keys already in bucket)
npm run sync:s3 -- --dir "/Users/apple/Desktop/short videso"

# Upload login/signup phone preview (from public/auth/ — not shipped in git on all clones)
npm run sync:auth-s3

# Upload landing scroll-scrub hero frames (120 webp from public/landing/scroll-sequence/)
npm run sync:landing-s3

# Verify locally
npm run verify:media -- --check-s3
```

Each reel uploads to the key already in `catalog.json` (`media.storageKey`). No catalog edit needed.

#### AWS S3 alternative

Same vars without `S3_ENDPOINT` / path style:

```
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
S3_PUBLIC_BASE_URL=https://your-bucket.s3.ap-south-1.amazonaws.com
```

Enable public read on `reels/*` or front with CloudFront.

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
    "googleEmbeddings": true,
    "s3": true
  },
  "storage": {
    "sessionStore": "postgres",
    "postgresOk": true,
    "vectorStore": "qdrant",
    "embeddingProvider": "google:gemini-embedding-001",
    "vectorCount": 253,
    "embeddingsCached": true,
    "objectStorage": {
      "driver": "s3",
      "configured": true,
      "ok": true,
      "bucket": "upstream-reels",
      "publicBaseUrl": "https://pub-xxxx.r2.dev"
    }
  },
  "media": {
    "total": 253,
    "withStorageKey": 192,
    "playable": 192,
    "posterOnly": 61,
    "byTier": { "hls": 0, "s3": 192, "local": 0, "poster": 61 }
  }
}
```

When S3 is missing or empty, `media.playable` stays low and `objectStorage.ok` is `false`.

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
| Reels show posters, no video | Upload with `npm run sync:s3`; set `S3_PUBLIC_BASE_URL` on Railway |
| `objectStorage.ok: false` | Check bucket credentials; run `npm run verify:media -- --check-s3` |
| Signup works then data gone after redeploy | Add Postgres + run `001_init.sql` |
| Agent search feels random | Set `GEMINI_API_KEY` — local 384d ≠ Google 768d cache |
| `vectorFallback` in health | Qdrant URL wrong or collection dim mismatch — check logs |
| `postgresOk: false` | Run migration SQL; verify `DATABASE_URL` reference |
