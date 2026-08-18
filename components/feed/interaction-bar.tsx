"use client";

import { Bookmark, Heart, Send, ThumbsDown, UserPlus } from "lucide-react";
import type { EventType, Reel } from "@/lib/types";
import { Avatar } from "@/components/ui/primitives";
import { cn, formatCount } from "@/lib/utils";

export interface ReelInteractionState {
  liked: boolean;
  saved: boolean;
  shared: boolean;
  dismissed: boolean;
}

export type SocialAction = "follow" | "unfollow";

export function InteractionBar({
  reel,
  state,
  following,
  onAction,
  onFollow,
  className,
}: {
  reel: Reel;
  state: ReelInteractionState;
  following: boolean;
  onAction: (type: EventType) => void;
  onFollow: (action: SocialAction) => void;
  className?: string;
}) {
  const actions = [
    {
      type: "like" as EventType,
      icon: Heart,
      label: "Like",
      active: state.liked,
      count: reel.stats.likes + (state.liked ? 1 : 0),
      activeClass: "text-danger",
    },
    {
      type: "save" as EventType,
      icon: Bookmark,
      label: "Save",
      active: state.saved,
      count: reel.stats.saves + (state.saved ? 1 : 0),
      activeClass: "text-primary-400",
    },
    {
      type: "share" as EventType,
      icon: Send,
      label: "Share",
      active: state.shared,
      count: Math.round(reel.stats.likes / 24),
      activeClass: "text-signal-400",
    },
    {
      type: "not_interested" as EventType,
      icon: ThumbsDown,
      label: "Not interested",
      active: state.dismissed,
      count: null,
      activeClass: "text-warn",
    },
  ];

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="relative">
        <Avatar
          name={reel.creator.name}
          hue={reel.creator.hue}
          size={40}
          className="ring-2 ring-white/25"
        />
        <button
          type="button"
          onClick={() => onFollow(following ? "unfollow" : "follow")}
          aria-pressed={following}
          aria-label={
            following ? `Unfollow ${reel.creator.handle}` : `Follow ${reel.creator.handle}`
          }
          className={cn(
            "focus-ring absolute -bottom-2 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full text-white transition-colors",
            following ? "bg-success" : "bg-primary-500 hover:bg-primary-600",
          )}
        >
          {following ? (
            <span aria-hidden className="text-[11px] leading-none font-bold">
              ✓
            </span>
          ) : (
            <UserPlus className="size-3" strokeWidth={2.6} aria-hidden />
          )}
        </button>
      </div>

      {actions.map((action) => (
        <button
          key={action.type}
          type="button"
          onClick={() => onAction(action.type)}
          aria-pressed={action.active}
          aria-label={action.label}
          className="focus-ring group flex flex-col items-center gap-1 rounded-sm"
        >
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-all duration-200 group-hover:bg-white/20 group-active:scale-90",
              action.active && "bg-white/20",
            )}
          >
            <action.icon
              className={cn(
                "size-5 transition-colors",
                action.active ? action.activeClass : "text-white",
              )}
              strokeWidth={2}
              fill={action.active && action.type !== "not_interested" ? "currentColor" : "none"}
              aria-hidden
            />
          </span>
          {action.count !== null && (
            <span className="text-mono-xs text-white/70">{formatCount(action.count)}</span>
          )}
        </button>
      ))}
    </div>
  );
}
