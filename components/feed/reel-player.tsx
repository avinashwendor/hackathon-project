"use client";

import { useEffect, useRef, useState } from "react";
import type { Reel } from "@/lib/types";
import { ReelCanvas } from "./reel-canvas";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Adaptive playback.

   HLS is the delivery format: the transcoder writes a four-rung ladder
   (1080/720/480/360) and a master playlist, and the player picks a rung from
   measured bandwidth and buffer health.

   Safari plays HLS natively, so hls.js is loaded only where MSE is required —
   and it is a dynamic import, so a feed with no real media never downloads it.
   Reels without media fall through to the generated canvas, which is what
   makes the demo work with an empty bucket.
--------------------------------------------------------------------------- */

export interface PlaybackStats {
  level: number;
  height: number;
  bitrateKbps: number;
  bufferSec: number;
  droppedFrames: number;
  autoLevel: boolean;
}

export function ReelPlayer({
  reel,
  active,
  muted = true,
  paused = false,
  onStats,
  onProgress,
  className,
}: {
  reel: Reel;
  active: boolean;
  muted?: boolean;
  paused?: boolean;
  onStats?: (stats: PlaybackStats) => void;
  onProgress?: (completion: number) => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const hasMedia = Boolean(reel.media.hlsUrl || reel.media.mp4Url) && !failed;

  // --- Source attach -----------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMedia) return;

    const hlsUrl = reel.media.hlsUrl;
    let destroy: (() => void) | undefined;

    if (hlsUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari, iOS): the platform's own ABR is better than ours.
      video.src = hlsUrl;
    } else if (hlsUrl) {
      let cancelled = false;
      void import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) {
          if (reel.media.mp4Url) video.src = reel.media.mp4Url;
          else setFailed(true);
          return;
        }
        const hls = new Hls({
          // Short segments and a small forward buffer: in a vertical feed the
          // user may swipe away at any moment, so buffering far ahead is waste.
          maxBufferLength: 12,
          maxMaxBufferLength: 24,
          startLevel: -1,
          capLevelToPlayerSize: true,
          enableWorker: true,
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            if (reel.media.mp4Url) video.src = reel.media.mp4Url;
            else setFailed(true);
          }
        });

        const report = () => {
          const level = hls.levels[hls.currentLevel];
          const quality = video.getVideoPlaybackQuality?.();
          onStats?.({
            level: hls.currentLevel,
            height: level?.height ?? 0,
            bitrateKbps: level ? Math.round(level.bitrate / 1000) : 0,
            bufferSec: video.buffered.length
              ? video.buffered.end(video.buffered.length - 1) - video.currentTime
              : 0,
            droppedFrames: quality?.droppedVideoFrames ?? 0,
            autoLevel: hls.autoLevelEnabled,
          });
        };
        hls.on(Hls.Events.LEVEL_SWITCHED, report);
        const timer = setInterval(report, 1000);

        destroy = () => {
          clearInterval(timer);
          hls.destroy();
        };
      });
      return () => {
        cancelled = true;
        destroy?.();
      };
    } else if (reel.media.mp4Url) {
      video.src = reel.media.mp4Url;
    }

    return () => destroy?.();
  }, [reel.media.hlsUrl, reel.media.mp4Url, hasMedia, onStats]);

  // --- Play / pause with the active slide --------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMedia) return;
    if (active && !paused) {
      video.play().catch(() => {
        // Autoplay refused without a gesture; the poster stays up, which is fine.
      });
    } else {
      video.pause();
      if (!active) video.currentTime = 0;
    }
  }, [active, hasMedia, paused]);

  // --- Completion reporting ----------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMedia || !onProgress) return;
    const onTime = () => {
      if (video.duration > 0) onProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [hasMedia, onProgress]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-ink-950", className)}>
      <ReelCanvas reel={reel} active={active} className={hasMedia ? "absolute inset-0" : ""} />
      {hasMedia && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted={muted}
          loop
          preload={active ? "auto" : "metadata"}
        />
      )}
    </div>
  );
}
