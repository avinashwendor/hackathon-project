"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Reel } from "@/lib/types";
import { FeedShimmer } from "./feed-shimmer";
import { cn } from "@/lib/utils";

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
  onReady,
  className,
}: {
  reel: Reel;
  active: boolean;
  muted?: boolean;
  paused?: boolean;
  onStats?: (stats: PlaybackStats) => void;
  onProgress?: (completion: number) => void;
  /** Fires once the video frame is visible (playing when active, first frame when idle). */
  onReady?: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const expectsVideo = Boolean(reel.media.storageKey || reel.media.hlsUrl || reel.media.mp4Url);
  const hasMedia = Boolean(reel.media.hlsUrl || reel.media.mp4Url) && !failed;

  const markReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    readyRef.current = false;
    setReady(false);
    setFailed(false);
  }, [reel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMedia) return;

    const hlsUrl = reel.media.hlsUrl;
    let destroy: (() => void) | undefined;

    if (hlsUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMedia) return;
    if (active && !paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
      if (!active) video.currentTime = 0;
    }
  }, [active, hasMedia, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMedia || !onProgress) return;
    const onTime = () => {
      if (video.duration > 0) onProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [hasMedia, onProgress]);

  const handleCanPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !paused) {
      void video.play().catch(() => {});
      return;
    }
    if (!active && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      markReady();
    }
  }, [active, markReady, paused]);

  const handlePlaying = useCallback(() => {
    markReady();
  }, [markReady]);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) markReady();
    else if (!paused) void video.play().catch(() => {});
  }, [active, markReady, paused]);

  if (!expectsVideo || failed) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-ink-950", className)}>
        <FeedShimmer className="absolute inset-0" />
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-ink-950", className)}>
      {!ready && <FeedShimmer className="absolute inset-0 z-10" />}
      {hasMedia && (
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            ready ? "opacity-100" : "opacity-0",
          )}
          playsInline
          muted={muted}
          loop
          preload={active ? "auto" : "auto"}
          onLoadedData={handleLoadedData}
          onCanPlay={handleCanPlay}
          onPlaying={handlePlaying}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
