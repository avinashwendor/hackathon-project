import type { Category, Difficulty, ReelLane } from "@/lib/types";

export interface VectorPayload {
  reelId: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  topics: string[];
  substance: number;
  lane: ReelLane;
  hyped: boolean;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  payload: VectorPayload;
}

export interface SearchFilter {
  lanes?: ReelLane[];
  categories?: Category[];
  minSubstance?: number;
  excludeIds?: string[];
  excludeHyped?: boolean;
}

export interface SearchHit {
  id: string;
  score: number;
  payload: VectorPayload;
}

export interface VectorStore {
  readonly name: string;
  init(dims: number): Promise<void>;
  upsert(records: VectorRecord[]): Promise<void>;
  search(vector: number[], limit: number, filter?: SearchFilter): Promise<SearchHit[]>;
  count(): Promise<number>;
  /** Raw vector for a known id — used to build the taste vector from history. */
  get(id: string): Promise<VectorRecord | undefined>;
  clear(): Promise<void>;
}

export function passesFilter(payload: VectorPayload, filter?: SearchFilter): boolean {
  if (!filter) return true;
  if (filter.lanes && !filter.lanes.includes(payload.lane) && payload.lane !== "both") return false;
  if (filter.categories && !filter.categories.includes(payload.category)) return false;
  if (filter.minSubstance !== undefined && payload.substance < filter.minSubstance) return false;
  if (filter.excludeIds?.includes(payload.reelId)) return false;
  if (filter.excludeHyped && payload.hyped) return false;
  return true;
}
