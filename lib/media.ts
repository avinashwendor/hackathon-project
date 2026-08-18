import { config } from "@/lib/config";
import type { Reel } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Playback URL resolution.

   The ingest pipeline records an `s3_object_key` for every reel before the
   files are uploaded, so a reel can exist in the catalog with no reachable
   media. Resolution therefore has three tiers and each is honest about itself:

   1. An HLS master playlist, if the transcoder has run — adaptive, preferred.
   2. The object in S3, once S3_PUBLIC_BASE_URL is set — progressive MP4.
   3. In development only, a local range-streaming route reading the ingest
      agent's own output directory, so the real videos play with no cloud at all.

   With none of those, the reel renders its generated poster instead of a broken
   <video>, which is why a fresh clone still looks like a finished product.
--------------------------------------------------------------------------- */

export interface ResolvedMedia {
  hlsUrl?: string;
  mp4Url?: string;
  /** Which tier answered, for the diagnostics panel. */
  tier: "hls" | "s3" | "local" | "poster";
}

/** S3 keys for the login/signup phone preview (upload with `npm run sync:auth-s3`). */
export const AUTH_PREVIEW_S3_KEYS = {
  video: "auth/feed-preview.webm",
  poster: "auth/feed-preview-poster.webp",
} as const;

/** S3 prefix for TripNine-style scroll-scrub landing hero (upload with `npm run sync:landing-s3`). */
export const LANDING_SCROLL_S3_PREFIX = "landing/scroll-sequence";
export const LANDING_SCROLL_FRAME_COUNT = 120;

export interface AuthPreviewMedia {
  video: string;
  poster: string;
  tier: "s3" | "local";
}

/** Build a same-origin proxy URL for a private-bucket object key. */
export function s3ProxyUrl(key: string): string {
  return `/api/media/s3/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Auth preview video — always from `public/auth/` (shipped in the container).
 * Reel MP4s use S3; these marketing assets stay on the app origin so login works
 * without a separate sync step.
 */
export function resolveAuthPreviewMedia(): AuthPreviewMedia {
  return {
    video: "/auth/feed-preview.webm",
    poster: "/auth/feed-preview-poster.webp",
    tier: "local",
  };
}

/** Base path for landing scroll-scrub frames in `public/landing/scroll-sequence/`. */
export function resolveLandingScrollFrameBase(): string {
  return "/landing/scroll-sequence";
}

export function landingScrollFrameUrl(base: string, frameIndex: number): string {
  const n = String(frameIndex + 1).padStart(4, "0");
  return `${base}/frame_${n}.webp`;
}

export function resolveMedia(reel: Reel): ResolvedMedia {
  if (reel.media.hlsUrl) return { hlsUrl: reel.media.hlsUrl, mp4Url: reel.media.mp4Url, tier: "hls" };

  const key = reel.media.storageKey;

  if (key && config.storage.publicBaseUrl) {
    return { mp4Url: `${config.storage.publicBaseUrl.replace(/\/$/, "")}/${key}`, tier: "s3" };
  }

  if (reel.media.mp4Url) return { mp4Url: reel.media.mp4Url, tier: "s3" };

  if (reel.media.localFile && config.media.serveLocal) {
    return { mp4Url: `/api/media/${encodeURI(reel.media.localFile)}`, tier: "local" };
  }

  return { tier: "poster" };
}

/** Apply resolution onto the reel so client components never do this themselves. */
export function withResolvedMedia(reel: Reel): Reel {
  const resolved = resolveMedia(reel);
  return {
    ...reel,
    media: {
      ...reel.media,
      ...(resolved.hlsUrl ? { hlsUrl: resolved.hlsUrl } : {}),
      ...(resolved.mp4Url ? { mp4Url: resolved.mp4Url } : {}),
    },
  };
}

export interface MediaStats {
  total: number;
  withStorageKey: number;
  playable: number;
  posterOnly: number;
  byTier: Record<ResolvedMedia["tier"], number>;
}

/** How many reels can actually play video in the current environment. */
export function mediaStats(reels: Reel[]): MediaStats {
  const byTier: MediaStats["byTier"] = { hls: 0, s3: 0, local: 0, poster: 0 };
  let withStorageKey = 0;

  for (const reel of reels) {
    if (reel.media.storageKey) withStorageKey++;
    const tier = resolveMedia(reel).tier;
    byTier[tier]++;
  }

  const playable = byTier.hls + byTier.s3 + byTier.local;
  return {
    total: reels.length,
    withStorageKey,
    playable,
    posterOnly: byTier.poster,
    byTier,
  };
}
