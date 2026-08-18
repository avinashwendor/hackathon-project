"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { Reel } from "@/lib/types";
import { FeedShimmer } from "@/components/feed/feed-shimmer";
import { cn } from "@/lib/utils";
import { ReelPoster } from "./reel-tile";

/** Playback URL for grid thumbnails — works with server-resolved or storageKey-only reels. */
export function reelThumbnailSrc(reel: Reel): string | undefined {
  if (reel.media.mp4Url) return reel.media.mp4Url;
  if (reel.media.storageKey) {
    return `/api/media/s3/${reel.media.storageKey.split("/").map(encodeURIComponent).join("/")}`;
  }
  return undefined;
}

/** Explore grid tile — real video first frame, not generated gradient posters. */
export function ReelThumbnail({ reel, className }: { reel: Reel; className?: string }) {
  const src = reelThumbnailSrc(reel);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !src) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    setReady(false);
  }, [reel.id, src]);

  if (!src) {
    return <ReelPoster reel={reel} className={className} />;
  }

  return (
    <div ref={containerRef} className={cn("relative isolate overflow-hidden bg-ink-950", className)}>
      {!ready && <FeedShimmer className="absolute inset-0 z-10" />}
      {inView && (
        <video
          ref={videoRef}
          src={src}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            ready ? "opacity-100" : "opacity-0",
          )}
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => {
            const video = videoRef.current;
            if (video) video.currentTime = 0.05;
            setReady(true);
          }}
          onError={() => setReady(false)}
        />
      )}
      <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/15 text-white/90">
        <Play className="size-5 fill-current" strokeWidth={0} />
      </span>
    </div>
  );
}
