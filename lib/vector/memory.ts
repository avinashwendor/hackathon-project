import { cosine } from "@/lib/embeddings";
import { passesFilter, type SearchFilter, type SearchHit, type VectorRecord, type VectorStore } from "./types";

/* ---------------------------------------------------------------------------
   In-process vector store.

   Exhaustive cosine over a few hundred vectors is sub-millisecond, so for this
   corpus an ANN index would add infrastructure and lose recall for no gain.
   The moment the corpus outgrows it, the Qdrant driver takes over behind the
   same interface — that switch is a single environment variable.
--------------------------------------------------------------------------- */

export class MemoryVectorStore implements VectorStore {
  readonly name = "memory:exhaustive-cosine";
  private records = new Map<string, VectorRecord>();
  private dims = 0;

  async init(dims: number): Promise<void> {
    if (this.dims && this.dims !== dims) {
      // Provider changed underneath us; the old space is meaningless now.
      this.records.clear();
    }
    this.dims = dims;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) this.records.set(record.id, record);
  }

  async search(vector: number[], limit: number, filter?: SearchFilter): Promise<SearchHit[]> {
    const hits: SearchHit[] = [];
    for (const record of this.records.values()) {
      if (!passesFilter(record.payload, filter)) continue;
      hits.push({ id: record.id, score: cosine(vector, record.vector), payload: record.payload });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  async count(): Promise<number> {
    return this.records.size;
  }

  async get(id: string): Promise<VectorRecord | undefined> {
    return this.records.get(id);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}
