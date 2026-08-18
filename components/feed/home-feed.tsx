"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { EventType, Reel } from "@/lib/types";
import type { DislikeReasonId } from "@/lib/social/dislike-reasons";
import {
  dislikeFeedbackMessage,
  likeFeedbackMessage,
} from "@/lib/social/feedback-messages";
import { LIKES_BEFORE_TASTE_REFRESH } from "@/lib/feed/feed-cache";
import { fetchFeedClient } from "@/lib/feed/client-fetch";
import { useViewer } from "@/components/auth/use-viewer";
import { Avatar } from "@/components/ui/primitives";
import { DislikeReasonDialog } from "@/components/feed/dislike-reason-dialog";
import { PostShimmer } from "@/components/feed/feed-shimmer";
import { TasteFeedbackToast, type TasteFeedbackMessage } from "@/components/feed/taste-feedback";
import { uniqueCreators } from "./stories-rail";
import { StoriesRail } from "./stories-rail";
import { PostCard, type PostState } from "./post-card";

const EMPTY: PostState = { liked: false, saved: false, disliked: false };
const PAGE_SIZE = 5;

async function fetchSocial() {
  try {
    const res = await fetch("/api/social", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      social: { follows: string[]; likes?: string[]; saves?: string[]; dislikes?: string[] };
    };
    return {
      follows: json.social.follows,
      likes: json.social.likes ?? [],
      saves: json.social.saves ?? [],
      dislikes: json.social.dislikes ?? [],
    };
  } catch {
    return null;
  }
}

async function fetchFeedPage(excludeIds: string[], limit = PAGE_SIZE, refresh = false) {
  return fetchFeedClient({ excludeIds, limit, refresh });
}

interface HomeFeedProps {
  initialReels?: Reel[];
  initialSource?: string;
  initialHasMore?: boolean;
}

export function HomeFeed({
  initialReels,
  initialSource = "",
  initialHasMore = true,
}: HomeFeedProps) {
  const { viewer } = useViewer();
  const [posts, setPosts] = useState<Reel[]>(initialReels ?? []);
  const [feedSource, setFeedSource] = useState(initialSource);
  const [loading, setLoading] = useState(!initialReels?.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [follows, setFollows] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, PostState>>({});
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [dislikeTarget, setDislikeTarget] = useState<Reel | null>(null);
  const [feedback, setFeedback] = useState<TasteFeedbackMessage | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const toastKeyRef = useRef<string | null>(null);
  const postsRef = useRef<Reel[]>([]);
  const likesSinceRefresh = useRef(0);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const appendUnique = useCallback((incoming: Reel[]) => {
    setPosts((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const next = [...prev, ...incoming.filter((r) => !ids.has(r.id))];
      return next;
    });
  }, []);

  const loadMore = useCallback(
    async (replace = false) => {
      const exclude = replace ? [] : postsRef.current.map((p) => p.id);
      const json = await fetchFeedPage(exclude, PAGE_SIZE);
      if (!json) return;
      if (replace) setPosts(json.reels);
      else appendUnique(json.reels);
      setFeedSource(json.source ?? "");
      setHasMore(json.hasMore);
    },
    [appendUnique],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const social = await fetchSocial();
      if (cancelled) return;
      if (!initialReels?.length) {
        await loadMore(true);
      }
      setLoading(false);
      if (social) {
        setFollows(social.follows);
        setStates((prev) => {
          const next = { ...prev };
          for (const id of social.likes) next[id] = { ...(next[id] ?? EMPTY), liked: true };
          for (const id of social.saves) next[id] = { ...(next[id] ?? EMPTY), saved: true };
          for (const id of social.dislikes) next[id] = { ...(next[id] ?? EMPTY), disliked: true };
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialReels?.length, loadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setLoadingMore(true);
        void loadMore(false).finally(() => setLoadingMore(false));
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore, posts.length]);

  const send = useCallback((reelId: string, type: EventType) => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [{ reelId, type, at: new Date().toISOString() }] }),
    }).catch(() => {});
  }, []);

  const socialAct = useCallback((reelId: string, action: string, extra?: Record<string, string>) => {
    void fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reelId, ...extra }),
    }).catch(() => {});
  }, []);

  const showFeedbackOnce = useCallback((key: string, tone: "like" | "dislike", title: string, body: string) => {
    if (toastKeyRef.current === key) return;
    toastKeyRef.current = key;
    setFeedback({ id: key, tone, title, body });
  }, []);

  const refreshTasteFeed = useCallback(async () => {
    const json = await fetchFeedPage(postsRef.current.map((p) => p.id), 3, true);
    if (!json?.reels.length) return;
    appendUnique(json.reels);
    setFeedSource(json.source ?? "taste");
    setHasMore(json.hasMore);
  }, [appendUnique]);

  const onTasteSignal = useCallback(() => {
    likesSinceRefresh.current += 1;
    if (likesSinceRefresh.current >= LIKES_BEFORE_TASTE_REFRESH) {
      likesSinceRefresh.current = 0;
      void refreshTasteFeed();
    }
  }, [refreshTasteFeed]);

  const prefetchAfterDislike = useCallback(async () => {
    const json = await fetchFeedPage(postsRef.current.map((p) => p.id), 3, true);
    if (json?.reels.length) appendUnique(json.reels);
  }, [appendUnique]);

  const submitDislike = useCallback(
    async (reason: DislikeReasonId, detail?: string) => {
      if (!dislikeTarget) return;
      const reel = dislikeTarget;
      setStates((prev) => ({
        ...prev,
        [reel.id]: { ...(prev[reel.id] ?? EMPTY), disliked: true },
      }));
      await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dislike", reelId: reel.id, reason, detail }),
      });
      send(reel.id, "not_interested");
      const msg = dislikeFeedbackMessage(reel, reason, detail);
      showFeedbackOnce(`${reel.id}-dislike-${Date.now()}`, "dislike", msg.title, msg.body);
      setDislikeTarget(null);
      await prefetchAfterDislike();
    },
    [dislikeTarget, prefetchAfterDislike, send, showFeedbackOnce],
  );

  const act = useCallback(
    (reelId: string, type: EventType) => {
      const reel = postsRef.current.find((p) => p.id === reelId);
      setStates((prev) => {
        const current = prev[reelId] ?? EMPTY;
        const next = { ...current };
        if (type === "like") {
          next.liked = !current.liked;
          socialAct(reelId, next.liked ? "like" : "unlike");
          if (next.liked) {
            send(reelId, "like");
            if (reel) {
              const msg = likeFeedbackMessage(reel);
              showFeedbackOnce(`${reelId}-like`, "like", msg.title, msg.body);
              onTasteSignal();
            }
          }
        } else if (type === "save") {
          next.saved = !current.saved;
          socialAct(reelId, next.saved ? "save" : "unsave");
          if (next.saved) send(reelId, "save");
        } else if (type === "not_interested") {
          if (current.disliked) {
            next.disliked = false;
            socialAct(reelId, "undislike");
          } else if (reel) {
            setDislikeTarget(reel);
            return prev;
          }
        } else {
          send(reelId, type);
        }
        return { ...prev, [reelId]: next };
      });
    },
    [onTasteSignal, send, showFeedbackOnce, socialAct],
  );

  const toggleFollow = useCallback((handle: string, following: boolean) => {
    setFollows((prev) =>
      following ? prev.filter((h) => h !== handle) : [...new Set([...prev, handle])],
    );
    void fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: following ? "unfollow" : "follow", handle }),
    }).catch(() => {});
  }, []);

  const suggestions = useMemo(() => {
    return uniqueCreators(posts)
      .filter((c) => !follows.includes(c.handle))
      .slice(0, 5);
  }, [posts, follows]);

  const selfName = viewer.account?.name ?? "you";
  const playablePosts = posts.filter((r) => r.media.mp4Url || r.media.storageKey);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[470px] px-3 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostShimmer key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-[935px] justify-center gap-16 px-0 pt-4 lg:pt-8">
        <div className="w-full max-w-[470px]">
          {feedSource && (
            <p className="mb-3 px-3 text-[12px] text-fg-subtle sm:px-0">
              For you · {feedSource} · {playablePosts.length} new
            </p>
          )}

          {playablePosts.length > 0 && (
            <StoriesRail
              reels={playablePosts}
              selfName={selfName}
              seen={seen}
              onSeen={(handle) => setSeen((prev) => new Set(prev).add(handle))}
            />
          )}

          <div className="mt-2 flex flex-col gap-4">
            {playablePosts.map((reel) => (
              <PostCard
                key={reel.id}
                reel={reel}
                state={states[reel.id] ?? EMPTY}
                following={follows.includes(reel.creator.handle)}
                onAction={(type) => act(reel.id, type)}
                onFollow={() =>
                  toggleFollow(reel.creator.handle, follows.includes(reel.creator.handle))
                }
              />
            ))}
          </div>

          <div ref={sentinelRef} className="py-8">
            {loadingMore && (
              <div className="flex justify-center">
                <Loader2 className="size-6 animate-spin text-fg-muted" />
              </div>
            )}
            {!hasMore && playablePosts.length > 0 && (
              <p className="text-center text-[13px] text-fg-subtle">
                You&apos;re caught up — like or pass on reels to refresh what&apos;s next.
              </p>
            )}
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 pt-2 xl:block">
          <div className="flex items-center gap-3">
            <Avatar name={selfName} hue={24} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{selfName}</p>
              <p className="truncate text-[14px] text-fg-muted">{viewer.account?.email}</p>
            </div>
            <Link href="/profile" className="text-[12px] font-semibold text-[#0095f6]">
              Profile
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-[14px] font-semibold text-fg-muted">Suggested for you</p>
            <Link href="/explore" className="text-[12px] font-semibold">
              See all
            </Link>
          </div>

          <ul className="mt-4 space-y-4">
            {suggestions.map((creator) => (
              <li key={creator.handle} className="flex items-center gap-3">
                <Avatar name={creator.name} hue={creator.hue} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {creator.handle.replace(/^@/, "")}
                  </p>
                  <p className="truncate text-[12px] text-fg-muted">{creator.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFollow(creator.handle, false)}
                  className="text-[12px] font-semibold text-[#0095f6]"
                >
                  Follow
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <DislikeReasonDialog
        open={Boolean(dislikeTarget)}
        reelTitle={dislikeTarget?.title ?? ""}
        onClose={() => setDislikeTarget(null)}
        onSubmit={submitDislike}
      />
      <TasteFeedbackToast
        message={feedback}
        onDismiss={() => {
          setFeedback(null);
          toastKeyRef.current = null;
        }}
      />
    </>
  );
}
