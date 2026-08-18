"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import type { EventType, Reel } from "@/lib/types";
import { ReelPlayer } from "./reel-player";
import { Avatar } from "@/components/ui/primitives";
import { cn, formatCount, formatFeedTime } from "@/lib/utils";

export interface PostState {
  liked: boolean;
  saved: boolean;
}

export function PostCard({
  reel,
  state,
  following,
  onAction,
  onFollow,
}: {
  reel: Reel;
  state: PostState;
  following: boolean;
  onAction: (type: EventType) => void;
  onFollow: () => void;
}) {
  const [burst, setBurst] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const tapRef = useRef<number | null>(null);

  const like = () => {
    if (!state.liked) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 850);
    }
    onAction("like");
  };

  const onMediaClick = () => {
    if (tapRef.current) {
      window.clearTimeout(tapRef.current);
      tapRef.current = null;
      if (!state.liked) like();
      else {
        setBurst(true);
        window.setTimeout(() => setBurst(false), 850);
      }
      return;
    }
    tapRef.current = window.setTimeout(() => {
      tapRef.current = null;
    }, 280);
  };

  const likes = reel.stats.likes + (state.liked ? 1 : 0);

  return (
    <article className="border-b border-line pb-4">
      <header className="flex items-center gap-3 px-3 py-3 sm:px-0">
        <span className="ig-story-ring rounded-full p-[2px]">
          <span className="block rounded-full bg-bg p-[1.5px]">
            <Avatar name={reel.creator.name} hue={reel.creator.hue} size={32} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{reel.creator.handle.replace(/^@/, "")}</span>
            {reel.creator.verified && (
              <span className="flex size-3.5 items-center justify-center rounded-full bg-[#0095f6] text-[9px] font-bold text-white">
                ✓
              </span>
            )}
            <span className="text-[14px] text-fg-subtle">· {formatFeedTime(reel.publishedAt).toLowerCase()}</span>
          </div>
          <p className="text-[12px] text-fg-muted">{reel.category}</p>
        </div>
        {!following && (
          <button
            type="button"
            onClick={onFollow}
            className="text-[13px] font-semibold text-[#0095f6]"
          >
            Follow
          </button>
        )}
        <button type="button" className="p-1 text-fg" aria-label="More">
          <MoreHorizontal className="size-5" />
        </button>
      </header>

      <div
        className="relative aspect-[4/5] cursor-pointer overflow-hidden bg-surface-2 sm:rounded-sm"
        onClick={onMediaClick}
      >
        <ReelPlayer reel={reel} active={false} muted className="absolute inset-0" />
        {burst && (
          <Heart
            className="animate-ig-heart pointer-events-none absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 text-white"
            fill="white"
            strokeWidth={0}
          />
        )}
      </div>

      <div className="flex items-center px-3 pt-2 sm:px-0">
        <button
          type="button"
          onClick={like}
          aria-label="Like"
          aria-pressed={state.liked}
          className={cn("p-2 -ml-2", state.liked && "animate-ig-like")}
        >
          <Heart
            className={cn("size-6", state.liked ? "text-[#ff3040]" : "text-fg")}
            fill={state.liked ? "currentColor" : "none"}
            strokeWidth={1.8}
          />
        </button>
        <Link href="/reels" className="p-2" aria-label="Comment">
          <MessageCircle className="size-6" strokeWidth={1.8} />
        </Link>
        <button type="button" onClick={() => onAction("share")} className="p-2" aria-label="Share">
          <Send className="size-6" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => onAction("save")}
          aria-label="Save"
          aria-pressed={state.saved}
          className="ml-auto p-2 -mr-2"
        >
          <Bookmark
            className="size-6"
            fill={state.saved ? "currentColor" : "none"}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div className="px-3 sm:px-0">
        <p className="text-[14px] font-semibold">{formatCount(likes)} likes</p>
        <p className={cn("mt-1 text-[14px] leading-5", !captionOpen && "line-clamp-2")}>
          <span className="font-semibold">{reel.creator.handle.replace(/^@/, "")} </span>
          {reel.caption}
        </p>
        {reel.caption.length > 90 && (
          <button
            type="button"
            onClick={() => setCaptionOpen((v) => !v)}
            className="text-[14px] text-fg-subtle"
          >
            {captionOpen ? "less" : "more"}
          </button>
        )}
        {reel.hashtags.length > 0 && (
          <p className="mt-1 text-[14px] text-[#e0f1ff]">
            {reel.hashtags.slice(0, 4).map((tag) => (
              <span key={tag}>#{tag.replace(/^#/, "")} </span>
            ))}
          </p>
        )}
        <Link href="/reels" className="mt-1 block text-[14px] text-fg-subtle">
          View all comments
        </Link>
        <p className="mt-1 text-[10px] tracking-[0.12em] text-fg-subtle">
          {formatFeedTime(reel.publishedAt)}
        </p>
      </div>
    </article>
  );
}
