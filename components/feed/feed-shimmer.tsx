"use client";

import { cn } from "@/lib/utils";

/** Instagram-style loading skeleton — no fake poster gradients. */
export function FeedShimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden bg-surface-2", className)}
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse bg-linear-to-br from-surface-2 via-surface to-surface-2" />
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/8 to-transparent" />
    </div>
  );
}

export function PostShimmer() {
  return (
    <article className="border-b border-line pb-4">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-0">
        <div className="size-8 shrink-0 animate-pulse rounded-full bg-surface" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-surface" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-surface" />
        </div>
      </div>
      <FeedShimmer className="aspect-[4/5] sm:rounded-sm" />
      <div className="mt-3 space-y-2 px-3 sm:px-0">
        <div className="h-3 w-20 animate-pulse rounded bg-surface" />
        <div className="h-3 w-full animate-pulse rounded bg-surface" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-surface" />
      </div>
    </article>
  );
}

export function ReelShimmer() {
  return <FeedShimmer className="h-full w-full" />;
}
