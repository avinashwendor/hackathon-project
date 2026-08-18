"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventType, Reel } from "@/lib/types";
import { useViewer } from "@/components/auth/use-viewer";
import { Avatar } from "@/components/ui/primitives";
import { uniqueCreators } from "./stories-rail";
import { StoriesRail } from "./stories-rail";
import { PostCard, type PostState } from "./post-card";

const EMPTY: PostState = { liked: false, saved: false };

async function fetchSocial(): Promise<{ follows: string[]; likes: string[]; saves: string[] } | null> {
  try {
    const res = await fetch("/api/social", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      social: { follows: string[]; likes?: string[]; saves?: string[] };
    };
    return {
      follows: json.social.follows,
      likes: json.social.likes ?? [],
      saves: json.social.saves ?? [],
    };
  } catch {
    return null;
  }
}

export function HomeFeed({ posts }: { posts: Reel[] }) {
  const { viewer } = useViewer();
  const [follows, setFollows] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, PostState>>({});
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const social = await fetchSocial();
      if (cancelled || !social) return;
      setFollows(social.follows);
      setStates((prev) => {
        const next = { ...prev };
        for (const id of social.likes) next[id] = { ...(next[id] ?? EMPTY), liked: true };
        for (const id of social.saves) next[id] = { ...(next[id] ?? EMPTY), saved: true };
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback((reelId: string, type: EventType) => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [{ reelId, type, at: new Date().toISOString() }] }),
    }).catch(() => {});
  }, []);

  const act = useCallback(
    (reelId: string, type: EventType) => {
      setStates((prev) => {
        const current = prev[reelId] ?? EMPTY;
        const next = { ...current };
        if (type === "like") next.liked = !current.liked;
        if (type === "save") next.saved = !current.saved;
        return { ...prev, [reelId]: next };
      });
      send(reelId, type);
    },
    [send],
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

  return (
    <div className="mx-auto flex max-w-[935px] justify-center gap-16 px-0 pt-4 lg:pt-8">
      <div className="w-full max-w-[470px]">
        <StoriesRail
          reels={posts}
          selfName={selfName}
          seen={seen}
          onSeen={(handle) => setSeen((prev) => new Set(prev).add(handle))}
        />

        <div className="mt-2 flex flex-col gap-4">
          {posts.map((reel) => (
            <PostCard
              key={reel.id}
              reel={reel}
              state={states[reel.id] ?? EMPTY}
              following={follows.includes(reel.creator.handle)}
              onAction={(type) => act(reel.id, type)}
              onFollow={() => toggleFollow(reel.creator.handle, follows.includes(reel.creator.handle))}
            />
          ))}
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
                <p className="truncate text-[14px] font-semibold">{creator.handle.replace(/^@/, "")}</p>
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

        <p className="mt-8 text-[12px] leading-5 text-fg-subtle">
          About · Help · API · Privacy · Terms
          <br />© {new Date().getFullYear()} Upstream
        </p>
      </aside>
    </div>
  );
}
