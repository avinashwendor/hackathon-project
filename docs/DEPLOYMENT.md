# Deployment

PromptWars **Top 10** requires a **working deployed link**. See [SUBMISSION.md](./SUBMISSION.md) for **public repo, single branch, < 10 MB**, and **2-attempt** rules before you deploy.

**Cloud Run** is recommended for PromptWars scoring; **Railway** is supported for hackathon demos ([RAILWAY.md](./RAILWAY.md)).

---

## Google Cloud Run (recommended for PromptWars)

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk) installed and authenticated
- A GCP project with Cloud Run and Artifact Registry enabled
- Billing enabled (Cloud Run free tier covers small demos)

### One-shot deploy

```bash
export PROJECT_ID=your-gcp-project
export REGION=asia-south1          # pick nearest region
export SERVICE=upstream
export AUTH_SECRET=$(openssl rand -hex 32)

gcloud config set project $PROJECT_ID

# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE

# Deploy
gcloud run deploy $SERVICE \
  --image gcr.io/$PROJECT_ID/$SERVICE \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --set-env-vars "AUTH_SECRET=$AUTH_SECRET,NODE_ENV=production" \
  --set-env-vars "NEXT_PUBLIC_APP_URL=https://<will-be-set-after-deploy>" \
  --set-env-vars "GOOGLE_API_KEY=your-key-from-aistudio"

# After deploy, copy the service URL and update NEXT_PUBLIC_APP_URL:
gcloud run services update $SERVICE --region $REGION \
  --update-env-vars "NEXT_PUBLIC_APP_URL=https://YOUR-SERVICE-URL"
```

### Health check

```bash
curl https://YOUR-SERVICE-URL.run.app/api/health
```

Expected: `{ "ok": true, "service": "upstream", ... }`

### Local Docker smoke test

```bash
docker build -t upstream .
docker run -p 8080:8080 \
  -e AUTH_SECRET=local-dev-secret \
  -e NEXT_PUBLIC_APP_URL=http://localhost:8080 \
  upstream
open http://localhost:8080
```

---

## Railway (alternative)

1. Push this repo to GitHub (public).
2. Create a Railway service from the repo — `railway.toml` is included.
3. Set environment variables from `.env.example` (minimum: `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`).
4. Health check path: `/api/health`.

---

## Required environment variables (production)

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | **Yes** | Session signing — generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Canonical app URL (must match deploy) |
| `GOOGLE_API_KEY` | Recommended | Google `text-embedding-004` embeddings (scoring) |
| `OMEGA_API_KEY` | Optional | Full LLM inference path |
| `QDRANT_URL` | Optional | External vector store |

---

## CI

GitHub Actions runs on every push to `main`:

- Typecheck
- Lint
- Unit tests
- Production build

See `.github/workflows/ci.yml`.
