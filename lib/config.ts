/* ---------------------------------------------------------------------------
   Environment.

   Everything degrades. The app must boot and demo correctly with zero secrets
   set — that is a hard requirement for a hackathon machine and for a first
   Railway deploy before the variables land. Each provider therefore reports
   whether it is configured, and the pipeline records which path it took in the
   diagnostics rather than pretending nothing happened.
--------------------------------------------------------------------------- */

function str(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const config = {
  appName: "Upstream",
  appUrl: str("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  /**
   * Google is used for embeddings only — generation stays on Omega C. Keeping
   * the two on separate providers means an outage or quota wall on one does not
   * take the other down with it.
   */
  google: {
    apiKey: str("GEMINI_API_KEY", str("GOOGLE_API_KEY")),
    baseUrl: str("GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
    embeddingModel: str("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
    /**
     * gemini-embedding-001 is natively 3072-d and Matryoshka-truncatable, so a
     * prefix is a valid embedding rather than a lossy crop. 768 is the size
     * Google documents as the quality/size sweet spot: it keeps retrieval
     * quality on a corpus this size while making the committed vector cache a
     * couple of megabytes instead of eight, and quartering the cosine cost.
     */
    embeddingDims: num("GEMINI_EMBEDDING_DIMS", 768),
    timeoutMs: num("GEMINI_TIMEOUT_MS", 45_000),
    temperature: num("GEMINI_TEMPERATURE", 0.25),
    batchSize: num("GEMINI_EMBED_BATCH", 32),
  },

  llm: {
    baseUrl: str("OMEGA_BASE_URL", "https://api.omegaplusapi.com/v1"),
    apiKey: str("OMEGA_API_KEY"),
    /** Gemini through the Omega C gateway — the fallback generation path. */
    model: str("OMEGA_MODEL", "claude-gemini-3-1-pro"),
    /** Cheaper/faster model for short classification calls. */
    fastModel: str("OMEGA_FAST_MODEL", "claude-sonnet-4-6"),
    timeoutMs: num("OMEGA_TIMEOUT_MS", 45_000),
    maxRetries: num("OMEGA_MAX_RETRIES", 2),
    temperature: num("OMEGA_TEMPERATURE", 0.25),
  },

  embeddings: {
    /** "google" | "local". Google is used whenever a Gemini key is present. */
    provider: str(
      "EMBEDDING_PROVIDER",
      str("GEMINI_API_KEY") || str("GOOGLE_API_KEY") ? "google" : "local",
    ),
    /** Dimensions of the deterministic fallback space. */
    localDims: 384,
  },

  vector: {
    /** "memory" | "qdrant" */
    driver: str("VECTOR_DRIVER", str("QDRANT_URL") ? "qdrant" : "memory"),
    qdrantUrl: str("QDRANT_URL"),
    qdrantApiKey: str("QDRANT_API_KEY"),
    collection: str("QDRANT_COLLECTION", "upstream_reels"),
  },

  database: {
    /** Railway Postgres — accounts, events, social graph persist here. */
    url: str("DATABASE_URL"),
  },

  storage: {
    /** "s3" | "local" */
    driver: str("STORAGE_DRIVER", str("S3_BUCKET") ? "s3" : "local"),
    bucket: str("S3_BUCKET"),
    region: str("S3_REGION", "ap-south-1"),
    accessKeyId: str("S3_ACCESS_KEY_ID"),
    secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    /** Set for R2/MinIO/any S3-compatible endpoint. */
    endpoint: str("S3_ENDPOINT"),
    forcePathStyle: bool("S3_FORCE_PATH_STYLE", false),
    /** CDN or public base used to build playback URLs. */
    publicBaseUrl: str("S3_PUBLIC_BASE_URL"),
    uploadPrefix: str("S3_UPLOAD_PREFIX", "reels"),
    presignExpirySec: num("S3_PRESIGN_EXPIRY", 900),
  },

  media: {
    /**
     * Where the ingest agent writes its reels. Only read in development: the
     * 943MB of video never ships in the container, so production plays from
     * object storage or falls back to the generated poster.
     */
    catalogDir: str("REELS_CATALOG_DIR"),
    serveLocal:
      process.env.NODE_ENV !== "production" && Boolean(str("REELS_CATALOG_DIR")),
  },

  agent: {
    /** How many candidates retrieval pulls before reranking. */
    retrievalK: num("AGENT_RETRIEVAL_K", 24),
    /** How many survive to the LLM reranker. */
    rerankK: num("AGENT_RERANK_K", 8),
    /** MMR trade-off: 1 = pure relevance, 0 = pure diversity. */
    mmrLambda: num("AGENT_MMR_LAMBDA", 0.72),
    /** Below this substance score a reel can never be recommended. */
    substanceFloor: num("AGENT_SUBSTANCE_FLOOR", 0.45),
    /** Signals older than this contribute half as much. */
    halfLifeMinutes: num("AGENT_HALF_LIFE_MINUTES", 240),
    /** Chance of deliberately serving an adjacent-domain reel to avoid a filter bubble. */
    serendipity: num("AGENT_SERENDIPITY", 0.15),
  },
} as const;

export const capabilities = {
  llm: Boolean(config.google.apiKey) || Boolean(config.llm.apiKey),
  gemini: Boolean(config.google.apiKey),
  omega: Boolean(config.llm.apiKey),
  googleEmbeddings: Boolean(config.google.apiKey),
  qdrant: Boolean(config.vector.qdrantUrl),
  postgres: Boolean(config.database.url),
  s3: Boolean(config.storage.bucket && config.storage.accessKeyId),
};

export type Capabilities = typeof capabilities;
