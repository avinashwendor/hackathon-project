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
