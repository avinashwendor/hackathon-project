import type { FeedResult } from "@/lib/feed/build-feed";

/** Cached ranked ids — avoids re-embedding on every pagination tap. */
export interface FeedRankCache {
  ids: string[];
  builtAt: string;
  source: FeedResult["source"];
  /** social.likes.length when this rank was built. */
  likeCount: number;
}

export const LIKES_BEFORE_TASTE_REFRESH = 3;

export const FEED_RANK_MAX = 120;

export const FEED_RANK_TTL_MS = 15 * 60_000;

export function feedRankStale(
  cache: FeedRankCache | undefined,
  likeCount: number,
  forceRefresh: boolean,
): boolean {
  if (forceRefresh || !cache?.ids?.length) return true;
  if (likeCount - cache.likeCount >= LIKES_BEFORE_TASTE_REFRESH) return true;
  return Date.now() - new Date(cache.builtAt).getTime() > FEED_RANK_TTL_MS;
}
