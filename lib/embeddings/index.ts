import { config } from "@/lib/config";
import type { Reel } from "@/lib/types";
import { LOCAL_DIMS, embedLocal, normalize } from "./local";

/* ---------------------------------------------------------------------------
   Embedding provider.

   Google's text-embedding-004 is free-tier and 768-dimensional; the local
   provider is a deterministic 384-dim hybrid. Because the two spaces are not
   comparable, every cached vector is tagged with the provider that produced
   it and a mismatch triggers a re-embed rather than a silent bad search.
--------------------------------------------------------------------------- */

export interface EmbedResult {
  vector: number[];
  provider: string;
  dims: number;
}

export interface EmbeddingProvider {
  name: string;
  dims: number;
  embed(texts: string[], taskType?: GoogleTaskType): Promise<number[][]>;
}

/* --- Google -------------------------------------------------------------- */

/**
 * Task types matter more than people expect. Google trains asymmetric spaces:
 * a document embedded as RETRIEVAL_DOCUMENT and a question embedded as
 * RETRIEVAL_QUERY land closer than either does under a symmetric encoding. The
 * agent's queries are questions about a person, so this is not a micro-detail.
 */
export type GoogleTaskType =
  | "SEMANTIC_SIMILARITY"
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "CLASSIFICATION";

/* ---------------------------------------------------------------------------
   Rate limiting.

   The free tier allows 100 embed requests per minute, and `batchEmbedContents`
   counts every *content* as a request, not every HTTP call. Embedding a 258-reel
   corpus in one pass therefore 429s immediately.

   A token bucket sized to the real quota makes the caller wait instead of fail.
   At runtime this is invisible — a recommendation embeds five or six queries —
   and at build time it turns a hard failure into a slower, correct run.
--------------------------------------------------------------------------- */

const RATE_LIMIT_PER_MINUTE = 90;
const WINDOW_MS = 60_000;
let requestTimestamps: number[] = [];

async function reserveQuota(count: number): Promise<void> {
  for (;;) {
    const now = Date.now();
    requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
    if (requestTimestamps.length + count <= RATE_LIMIT_PER_MINUTE) {
      const stamp = Date.now();
      for (let i = 0; i < count; i++) requestTimestamps.push(stamp);
      return;
    }
    const oldest = requestTimestamps[0] ?? now;
    const wait = Math.max(250, WINDOW_MS - (now - oldest) + 150);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function googleEmbed(
  texts: string[],
  taskType: GoogleTaskType = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  const { apiKey, embeddingModel, baseUrl, embeddingDims, batchSize } = config.google;
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const attempt = async (): Promise<number[][]> => {
      await reserveQuota(batch.length);
      const res = await fetch(
        `${baseUrl}/models/${embeddingModel}:batchEmbedContents?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${embeddingModel}`,
              content: { parts: [{ text: text.slice(0, 8000) }] },
              taskType,
              outputDimensionality: embeddingDims,
            })),
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) {
          // Honour the server's own retryDelay when it gives one.
          const delay = /"retryDelay":\s*"(\d+)s"/.exec(body)?.[1];
          throw Object.assign(new Error(`Google embeddings rate limited`), {
            retryAfterMs: (Number(delay) || 20) * 1000,
          });
        }
        throw new Error(`Google embeddings ${res.status}: ${body.slice(0, 240)}`);
      }

      const json = (await res.json()) as { embeddings?: { values: number[] }[] };
      if (!json.embeddings || json.embeddings.length !== batch.length) {
        throw new Error("Google embeddings returned an unexpected shape");
      }
      // Truncated Matryoshka vectors are no longer unit length, so normalising
      // is required, not cosmetic — cosine would otherwise be scaled by norm.
      return json.embeddings.map((e) => normalize(e.values));
    };

    let lastError: unknown;
    for (let retry = 0; retry < 5; retry++) {
      try {
        out.push(...(await attempt()));
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const retryAfter = (err as { retryAfterMs?: number }).retryAfterMs;
        await new Promise((r) => setTimeout(r, retryAfter ?? 900 * 2 ** retry));
      }
    }
    if (lastError) throw lastError;
  }

  return out;
}

/* --- Selection ----------------------------------------------------------- */

let warned = false;

export function getProvider(): EmbeddingProvider {
  if (config.embeddings.provider === "google" && config.google.apiKey) {
    return {
      name: `google:${config.google.embeddingModel}`,
      dims: config.google.embeddingDims,
      embed: (texts, taskType) => googleEmbed(texts, taskType),
    };
  }
  if (config.embeddings.provider === "google" && !warned) {
    warned = true;
    console.warn("[embeddings] GEMINI_API_KEY missing — using the deterministic local provider.");
  }
  return {
    name: "local:hybrid-v2",
    dims: LOCAL_DIMS,
    embed: async (texts) => texts.map((t) => embedLocal(t)),
  };
}

/** The text a reel is indexed by. Order matters: title and topic carry most weight. */
export function reelDocument(reel: Reel): string {
  return [
    reel.title,
    reel.caption,
    `Category: ${reel.category}. Difficulty: ${reel.difficulty}.`,
    `Topics: ${reel.topics.join(", ")}.`,
    reel.outcome ? `You will be able to: ${reel.outcome}` : "",
    reel.prerequisites.length ? `Assumes: ${reel.prerequisites.join(", ")}.` : "",
    reel.transcript,
    reel.hashtags.map((h) => `#${h}`).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Embed reels. The local provider gets the structured fields directly so its
 * symbolic slots are exact rather than inferred from prose.
 */
export async function embedReels(reels: Reel[]): Promise<{ vectors: number[][]; provider: EmbeddingProvider }> {
  const provider = getProvider();
  if (provider.name.startsWith("local")) {
    return {
      provider,
      vectors: reels.map((reel) =>
        embedLocal({
          text: reelDocument(reel),
          topics: reel.topics,
          category: reel.category,
          difficulty: reel.difficulty,
          substance: reel.substance,
        }),
      ),
    };
  }
  return { provider, vectors: await provider.embed(reels.map(reelDocument), "RETRIEVAL_DOCUMENT") };
}

export async function embedQuery(text: string): Promise<EmbedResult> {
  const provider = getProvider();
  const [vector] = await provider.embed([text], "RETRIEVAL_QUERY");
  return { vector, provider: provider.name, dims: provider.dims };
}

export async function embedQueries(
  texts: string[],
): Promise<{ vectors: number[][]; provider: EmbeddingProvider }> {
  const provider = getProvider();
  return { vectors: await provider.embed(texts, "RETRIEVAL_QUERY"), provider };
}

/* --- Vector maths -------------------------------------------------------- */

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function addScaled(target: number[], source: number[], scale: number): number[] {
  const out = target.length ? [...target] : new Array<number>(source.length).fill(0);
  for (let i = 0; i < source.length; i++) out[i] = (out[i] ?? 0) + source[i] * scale;
  return out;
}

export { normalize };
