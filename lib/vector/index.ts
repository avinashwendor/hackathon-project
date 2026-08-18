import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { embedReels, getProvider, reelDocument } from "@/lib/embeddings";
import type { Reel } from "@/lib/types";
import { ALL_REELS, registerRuntimeReel } from "@/data/reels";
import { readRuntimeReels } from "@/lib/store";
import { MemoryVectorStore } from "./memory";
import { QdrantVectorStore } from "./qdrant";
import type { SearchFilter, SearchHit, VectorRecord, VectorStore } from "./types";

export * from "./types";

/* ---------------------------------------------------------------------------
   Index lifecycle.

   Embedding the corpus is the one genuinely slow, rate-limited step, so the
   vectors are cached on disk keyed by provider + corpus fingerprint. A cold
   start with a warm cache is instant; a changed catalog or a switched provider
   invalidates it automatically. Qdrant failures fall back to the in-memory
   store rather than taking the app down — a demo that still works beats an
   error page that is technically more correct.
--------------------------------------------------------------------------- */

const CACHE_DIR = path.join(process.cwd(), "data", "generated");

interface CacheFile {
  provider: string;
  dims: number;
  vectors: Record<string, number[]>;
  /** Content hash per reel, so a single edited reel re-embeds alone. */
  hashes?: Record<string, string>;
}

export interface IndexInfo {
  store: string;
  provider: string;
  dims: number;
  count: number;
  cached: boolean;
  fallbackReason?: string;
}

let indexPromise: Promise<{ store: VectorStore; info: IndexInfo }> | null = null;

/** FNV-1a over a reel's indexed document — the unit of cache invalidation. */
export function documentHash(document: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < document.length; i++) {
    h ^= document.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function cachePath(provider: string): string {
  return path.join(CACHE_DIR, `embeddings.${provider.replace(/[^a-z0-9]+/gi, "-")}.json`);
}

async function readCache(provider: string, dims: number): Promise<CacheFile | null> {
  try {
    const raw = await fs.readFile(cachePath(provider), "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    // A provider or dimension change makes the stored space meaningless.
    if (parsed.provider !== provider || parsed.dims !== dims) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(file: CacheFile): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cachePath(file.provider), JSON.stringify(file), "utf8");
  } catch (err) {
    // A read-only filesystem is fine — it only costs us the warm start.
    console.warn("[vector] could not persist embedding cache:", (err as Error).message);
  }
}

export function toRecord(reel: Reel, vector: number[]): VectorRecord {
  return {
    id: reel.id,
    vector,
    payload: {
      reelId: reel.id,
      title: reel.title,
      category: reel.category,
      difficulty: reel.difficulty,
      topics: reel.topics,
      substance: reel.substance,
      lane: reel.lane,
      hyped: reel.hypeMarkers.length > 0,
    },
  };
}

async function build(): Promise<{ store: VectorStore; info: IndexInfo }> {
  const started = Date.now();
  const provider = getProvider();

  // Reels ingested in an earlier process are re-registered before the index is
  // built, so a restart does not lose everything the studio added.
  for (const reel of await readRuntimeReels()) registerRuntimeReel(reel);

  const reels = ALL_REELS;

  /*
   * Incremental cache. Each reel is keyed by the hash of the exact text it is
   * indexed by, so editing one reel re-embeds one reel — not the whole corpus.
   * That matters because the corpus is a few hundred reels and the embedding
   * provider is rate-limited to 100 requests a minute: an all-or-nothing cache
   * turns a one-word edit into a three-minute stall.
   */
  const cache = await readCache(provider.name, provider.dims);
  const documents = reels.map(reelDocument);
  const hashes = documents.map(documentHash);

  const vectors: (number[] | undefined)[] = reels.map((reel, i) =>
    cache?.hashes?.[reel.id] === hashes[i] ? cache.vectors[reel.id] : undefined,
  );

  const missing = reels
    .map((reel, i) => ({ reel, i }))
    .filter(({ i }) => !vectors[i] || vectors[i]!.length !== provider.dims);
  const cached = missing.length === 0;

  if (missing.length) {
    console.log(`[vector] embedding ${missing.length}/${reels.length} reels (${cache ? "cache miss" : "cold"})`);
    const result = await embedReels(missing.map(({ reel }) => reel));
    missing.forEach(({ i }, k) => {
      vectors[i] = result.vectors[k];
    });

    await writeCache({
      provider: provider.name,
      dims: provider.dims,
      vectors: Object.fromEntries(reels.map((r, i) => [r.id, vectors[i]!])),
      hashes: Object.fromEntries(reels.map((r, i) => [r.id, hashes[i]])),
    });
  }

  const dims = vectors[0]?.length ?? provider.dims;
  const records = reels.map((reel, i) => toRecord(reel, vectors[i]!));

  let store: VectorStore = new MemoryVectorStore();
  let fallbackReason: string | undefined;

  if (config.vector.driver === "qdrant") {
    const qdrant = new QdrantVectorStore();
    try {
      await qdrant.init(dims);
      await qdrant.upsert(records);
      store = qdrant;
    } catch (err) {
      fallbackReason = `Qdrant unavailable (${(err as Error).message.slice(0, 120)}) — served from memory`;
      console.warn("[vector]", fallbackReason);
    }
  }

  if (store instanceof MemoryVectorStore) {
    await store.init(dims);
    await store.upsert(records);
  }

  const info: IndexInfo = {
    store: store.name,
    provider: provider.name,
    dims,
    count: await store.count(),
    cached,
    fallbackReason,
  };

  console.log(
    `[vector] ${info.count} reels indexed in ${Date.now() - started}ms ` +
      `(${info.provider}, ${info.dims}d, ${info.store}${cached ? ", cached" : ""})`,
  );

  return { store, info };
}

export function getIndex(): Promise<{ store: VectorStore; info: IndexInfo }> {
  if (!indexPromise) {
    indexPromise = build().catch((err) => {
      indexPromise = null;
      throw err;
    });
  }
  return indexPromise;
}

export async function searchVectors(
  vector: number[],
  limit: number,
  filter?: SearchFilter,
): Promise<SearchHit[]> {
  const { store } = await getIndex();
  return store.search(vector, limit, filter);
}

export async function vectorFor(reelId: string): Promise<number[] | undefined> {
  const { store } = await getIndex();
  return (await store.get(reelId))?.vector;
}

/** Index a reel that arrived after boot (studio upload). */
export async function indexReel(reel: Reel): Promise<void> {
  const { store } = await getIndex();
  const { vectors } = await embedReels([reel]);
  await store.upsert([toRecord(reel, vectors[0])]);
}

export async function indexInfo(): Promise<IndexInfo> {
  return (await getIndex()).info;
}
