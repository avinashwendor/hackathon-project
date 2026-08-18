import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEED_RANK_TTL_MS,
  LIKES_BEFORE_TASTE_REFRESH,
  feedRankStale,
} from "@/lib/feed/feed-cache";
import { collectHardExclude, collectSoftExclude } from "@/lib/feed/build-feed";
import { EMPTY_SOCIAL } from "@/lib/store/types";

describe("feed rank cache", () => {
  const fresh = {
    ids: ["a", "b"],
    builtAt: new Date().toISOString(),
    source: "taste",
    likeCount: 0,
  };

  it("is stale when empty, forced, or like-count crossed the refresh gate", () => {
    assert.equal(feedRankStale(undefined, 0, false), true);
    assert.equal(feedRankStale({ ...fresh, ids: [] }, 0, false), true);
    assert.equal(feedRankStale(fresh, 0, true), true);
    assert.equal(feedRankStale(fresh, LIKES_BEFORE_TASTE_REFRESH, false), true);
  });

  it("is fresh within TTL when likes have not moved enough", () => {
    assert.equal(feedRankStale(fresh, 1, false), false);
    assert.ok(FEED_RANK_TTL_MS > 60_000);
  });

  it("expires after the ranked-id TTL", () => {
    const old = {
      ...fresh,
      builtAt: new Date(Date.now() - FEED_RANK_TTL_MS - 1_000).toISOString(),
    };
    assert.equal(feedRankStale(old, 0, false), true);
  });
});

describe("feed exclusion sets", () => {
  it("hard-excludes disliked reels so they never re-enter ranking", () => {
    const social = { ...EMPTY_SOCIAL, dislikes: ["bad-1"] };
    const hard = collectHardExclude(social, ["extra"]);
    assert.ok(hard.has("bad-1"));
    assert.ok(hard.has("extra"));
  });

  it("soft-excludes seen and watched ids without treating them as dislikes", () => {
    const social = { ...EMPTY_SOCIAL, seenReels: ["seen-1"] };
    const events = [{ id: "e", sessionId: "t", reelId: "watched-1", type: "view", at: new Date().toISOString() }];
    const soft = collectSoftExclude(social, events, ["page"]);
    assert.ok(soft.has("seen-1"));
    assert.ok(soft.has("watched-1"));
    assert.ok(soft.has("page"));
  });
});
