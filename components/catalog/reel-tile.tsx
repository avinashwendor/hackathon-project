import { BarChart3, Bookmark, Clock, Play } from "lucide-react";
import type { Reel } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { cn, formatCount, formatDuration } from "@/lib/utils";

/** Static poster derived from the reel's own hues — same seed as the feed canvas. */
export function ReelPoster({ reel, className }: { reel: Reel; className?: string }) {
  const { from, to, angle } = reel.media.poster;
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-md", className)}
      style={{
        background: `linear-gradient(${angle}deg, hsl(${from} 62% 26%), hsl(${to} 58% 14%))`,
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 20% 15%, hsl(${from} 85% 60% / 0.5), transparent 62%)`,
        }}
      />
      <div className="grain-layer absolute inset-0 opacity-[0.07] mix-blend-overlay" />
      <span className="absolute inset-0 flex items-center justify-center text-white/85">
        <Play className="size-5 fill-current" strokeWidth={0} />
      </span>
    </div>
  );
}

export function ReelTile({
  reel,
  className,
  highlight = false,
  blocked = false,
}: {
  reel: Reel;
  className?: string;
  highlight?: boolean;
  /** Retrieval found it, but the guardrail would refuse to serve it. */
  blocked?: boolean;
}) {
  return (
    <article
      className={cn(
        "group flex gap-4 rounded-lg border bg-surface p-4 transition-shadow",
        blocked
          ? "border-danger/25 bg-danger-soft/30"
          : highlight
            ? "border-primary-200 shadow-md"
            : "border-line hover:shadow-md",
        className,
      )}
    >
      <ReelPoster reel={reel} className="h-24 w-16 shrink-0 sm:h-28 sm:w-[74px]" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={blocked ? "danger" : highlight ? "primary" : "neutral"}>{reel.category}</Badge>
          <span className="text-mono-xs text-fg-subtle">{reel.difficulty}</span>
          {blocked && <Badge tone="danger">never recommended</Badge>}
        </div>

        <h3
          className={cn(
            "mt-2 text-[15px] leading-6 font-medium text-balance text-fg",
            blocked && "line-through decoration-danger/40",
          )}
        >
          {reel.title}
        </h3>

        {reel.outcome && (
          <p className="mt-1.5 line-clamp-2 text-body text-fg-muted">{reel.outcome}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-mono-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" strokeWidth={2} aria-hidden />
            {formatDuration(reel.durationSec)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-3.5" strokeWidth={2} aria-hidden />
            substance {reel.substance.toFixed(2)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark className="size-3.5" strokeWidth={2} aria-hidden />
            {formatCount(reel.stats.saves)}
          </span>
          <span className="truncate">{reel.creator.handle}</span>
        </div>
      </div>
    </article>
  );
}
