import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTH_PREVIEW_S3_KEYS,
  LANDING_SCROLL_FRAME_COUNT,
  landingScrollFrameUrl,
  mediaStats,
  resolveAuthPreviewMedia,
  resolveLandingScrollFrameBase,
  resolveMedia,
  s3ProxyUrl,
  withResolvedMedia,
} from "@/lib/media";
import { objectKey, publicUrlFor, storageDriver } from "@/lib/storage";
import { languageFromName, normalizeWorkspacePath } from "@/lib/webcontainer/workspace";
import { getReel } from "@/data/reels";

describe("media resolution", () => {
  it("prefers HLS, then S3, then a generated poster — never a broken video", () => {
    const reel = getReel("feed-java-meme");
    const poster = resolveMedia({ ...reel, media: { poster: reel.media.poster } });
    assert.equal(poster.tier, "poster");

    const hls = resolveMedia({
      ...reel,
      media: { ...reel.media, hlsUrl: "https://cdn.example/master.m3u8" },
    });
    assert.equal(hls.tier, "hls");
    assert.equal(hls.hlsUrl, "https://cdn.example/master.m3u8");
  });

  it("copies resolved URLs onto the reel the player actually reads", () => {
    const reel = getReel("feed-java-meme");
    const resolved = withResolvedMedia({
      ...reel,
      media: { ...reel.media, hlsUrl: "https://cdn.example/master.m3u8" },
    });
    assert.equal(resolved.media.hlsUrl, "https://cdn.example/master.m3u8");
  });

  it("keeps auth preview on the app origin so login works without S3", () => {
    const preview = resolveAuthPreviewMedia();
    assert.equal(preview.video, "/auth/feed-preview.webm");
    assert.equal(preview.poster, "/auth/feed-preview-poster.webp");
    assert.equal(AUTH_PREVIEW_S3_KEYS.video, "auth/feed-preview.webm");
  });

  it("numbers landing scroll frames with a stable four-digit pad", () => {
    const base = resolveLandingScrollFrameBase();
    assert.equal(landingScrollFrameUrl(base, 0), `${base}/frame_0001.webp`);
    assert.equal(LANDING_SCROLL_FRAME_COUNT, 120);
  });

  it("encodes S3 keys so nested paths survive the proxy route", () => {
    assert.equal(s3ProxyUrl("reels/foo bar.mp4"), "/api/media/s3/reels/foo%20bar.mp4");
  });

  it("reports playable vs poster-only counts for diagnostics", () => {
    const stats = mediaStats([getReel("feed-java-meme")]);
    assert.equal(stats.total, 1);
    assert.equal(stats.byTier.poster + stats.byTier.hls + stats.byTier.s3 + stats.byTier.local, 1);
  });
});

describe("upload keys", () => {
  it("sanitises filenames and prefixes them for the bucket", () => {
    const key = objectKey("My Cool Reel!!!.MP4");
    assert.match(key, /^reels\//);
    assert.match(key, /my-cool-reel/);
    assert.ok(!key.includes(" "));
  });

  it("builds a local public URL when no bucket is configured", () => {
    if (storageDriver() === "local") {
      assert.equal(publicUrlFor("reels/abc-file.mp4"), "/media/uploads/abc-file.mp4");
    }
  });
});

describe("in-browser IDE workspace", () => {
  it("maps editor languages from filename extensions", () => {
    assert.equal(languageFromName("index.ts"), "typescript");
    assert.equal(languageFromName("App.tsx"), "typescript");
    assert.equal(languageFromName("run.mjs"), "javascript");
    assert.equal(languageFromName("README.md"), "markdown");
    assert.equal(languageFromName("notes"), "plaintext");
  });

  it("rejects path traversal in workspace writes", () => {
    assert.equal(normalizeWorkspacePath("src/index.ts"), "src/index.ts");
    assert.equal(normalizeWorkspacePath("./src/index.ts"), "src/index.ts");
    assert.equal(normalizeWorkspacePath("../secret"), null);
    assert.equal(normalizeWorkspacePath("/etc/passwd"), null);
    assert.equal(normalizeWorkspacePath(""), null);
  });
});
