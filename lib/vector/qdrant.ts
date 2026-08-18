import { config } from "@/lib/config";
import type { SearchFilter, SearchHit, VectorRecord, VectorStore } from "./types";

/* ---------------------------------------------------------------------------
   Qdrant driver, over the REST API.

   No SDK: the four calls we need are plain JSON, and skipping the dependency
   keeps the serverless bundle small. Qdrant point ids must be integers or
   UUIDs, so the reel id lives in the payload and the point id is a stable
   hash of it.
--------------------------------------------------------------------------- */

function pointId(reelId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < reelId.length; i++) {
    h ^= reelId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class QdrantVectorStore implements VectorStore {
  readonly name = "qdrant";
  private collection = config.vector.collection;
  private dims = 0;

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${config.vector.qdrantUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(config.vector.qdrantApiKey ? { "api-key": config.vector.qdrantApiKey } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Qdrant ${init?.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async init(dims: number): Promise<void> {
    this.dims = dims;
    const existing = await this.call<{ result?: { config?: { params?: { vectors?: { size?: number } } } } }>(
      `/collections/${this.collection}`,
    ).catch(() => null);

    const currentSize = existing?.result?.config?.params?.vectors?.size;
    if (currentSize === dims) return;

    if (existing) {
      // Dimension change means the stored space no longer matches the provider.
      await this.call(`/collections/${this.collection}`, { method: "DELETE" });
    }
    await this.call(`/collections/${this.collection}`, {
      method: "PUT",
      body: JSON.stringify({ vectors: { size: dims, distance: "Cosine" } }),
    });
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    if (!records.length) return;
    await this.call(`/collections/${this.collection}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({
        points: records.map((r) => ({
          id: pointId(r.id),
          vector: r.vector,
          payload: r.payload,
        })),
      }),
    });
  }

  async search(vector: number[], limit: number, filter?: SearchFilter): Promise<SearchHit[]> {
    const must: unknown[] = [];
    const mustNot: unknown[] = [];
    if (filter?.categories?.length) {
      must.push({ key: "category", match: { any: filter.categories } });
    }
    if (filter?.minSubstance !== undefined) {
      must.push({ key: "substance", range: { gte: filter.minSubstance } });
    }
    if (filter?.excludeHyped) {
      mustNot.push({ key: "hyped", match: { value: true } });
    }
    if (filter?.excludeIds?.length) {
      mustNot.push({ key: "reelId", match: { any: filter.excludeIds } });
    }
    if (filter?.lanes?.length) {
      must.push({ key: "lane", match: { any: [...filter.lanes, "both"] } });
    }

    const body = {
      vector,
      limit,
      with_payload: true,
      ...(must.length || mustNot.length
        ? { filter: { ...(must.length ? { must } : {}), ...(mustNot.length ? { must_not: mustNot } : {}) } }
        : {}),
    };

    const json = await this.call<{ result: { id: number; score: number; payload: SearchHit["payload"] }[] }>(
      `/collections/${this.collection}/points/search`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return json.result.map((r) => ({ id: r.payload.reelId, score: r.score, payload: r.payload }));
  }

  async count(): Promise<number> {
    const json = await this.call<{ result: { count: number } }>(
      `/collections/${this.collection}/points/count`,
      { method: "POST", body: JSON.stringify({ exact: true }) },
    );
    return json.result.count;
  }

  async get(id: string): Promise<VectorRecord | undefined> {
    const json = await this.call<{
      result: { id: number; vector: number[]; payload: VectorRecord["payload"] }[];
    }>(`/collections/${this.collection}/points`, {
      method: "POST",
      body: JSON.stringify({ ids: [pointId(id)], with_vector: true, with_payload: true }),
    }).catch(() => null);
    const point = json?.result?.[0];
    if (!point) return undefined;
    return { id, vector: point.vector, payload: point.payload };
  }

  async clear(): Promise<void> {
    await this.call(`/collections/${this.collection}`, { method: "DELETE" }).catch(() => {});
    if (this.dims) await this.init(this.dims);
  }
}
