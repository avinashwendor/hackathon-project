import type { Reel } from "@/lib/types";

export interface FeedClientResult {
  reels: Reel[];
  source?: string;
  hasMore: boolean;
}

export async function fetchFeedClient(options: {
  excludeIds?: string[];
  limit?: number;
  refresh?: boolean;
}): Promise<FeedClientResult | null> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 5) });
  if (options.excludeIds?.length) {
    params.set("exclude", options.excludeIds.join(","));
  }
  if (options.refresh) params.set("refresh", "1");

  try {
    const res = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as FeedClientResult;
  } catch {
    return null;
  }
}
