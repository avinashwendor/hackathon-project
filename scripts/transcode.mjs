#!/usr/bin/env node
/**
 * Build an adaptive HLS ladder from a source video.
 *
 *   node scripts/transcode.mjs --input reel.mp4 --id my-reel [--upload]
 *
 * Produces four renditions plus a master playlist:
 *
 *   1080x1920  5000k   360x640    600k
 *    720x1280  2800k   480x854   1200k
 *
 * The rungs are chosen for vertical short-form on mobile networks: the bottom
 * rung is small enough to start on a bad connection, and the gaps are roughly
 * 2× apart so the player's bandwidth estimate can actually distinguish them.
 * Segments are 4 seconds — short enough to switch quickly, long enough that a
 * 45-second reel is not 45 HTTP requests.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const RENDITIONS = [
  { height: 1920, width: 1080, bitrate: "5000k", maxrate: "5350k", bufsize: "7500k", audio: "192k" },
  { height: 1280, width: 720, bitrate: "2800k", maxrate: "2996k", bufsize: "4200k", audio: "128k" },
  { height: 854, width: 480, bitrate: "1200k", maxrate: "1284k", bufsize: "1800k", audio: "128k" },
  { height: 640, width: 360, bitrate: "600k", maxrate: "642k", bufsize: "900k", audio: "96k" },
];

const SEGMENT_SECONDS = 4;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function ffprobeHeight(input) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=height",
      "-of", "csv=p=0",
      input,
    ]);
    let buffer = "";
    child.stdout.on("data", (chunk) => (buffer += chunk));
    child.on("close", () => resolve(Number(buffer.trim()) || 0));
    child.on("error", () => resolve(0));
  });
}

async function main() {
  const args = parseArgs();
  const input = args.input;
  if (!input) {
    console.error("Usage: node scripts/transcode.mjs --input <file> [--id <slug>] [--upload]");
    process.exit(1);
  }

  const id = args.id ?? path.basename(input).replace(/\.[^.]+$/, "");
  const outDir = path.resolve(args.out ?? path.join("public", "media", "hls", id));
  await fs.mkdir(outDir, { recursive: true });

  const sourceHeight = await ffprobeHeight(input);
  // Never upscale: a 720p source gets a 3-rung ladder, not a fake 1080p rung.
  const ladder = RENDITIONS.filter((r) => !sourceHeight || r.height <= sourceHeight);
  if (!ladder.length) ladder.push(RENDITIONS[RENDITIONS.length - 1]);

  console.log(`→ ${id}: source ${sourceHeight || "unknown"}p, ${ladder.length} renditions`);

  for (const rendition of ladder) {
    const name = `${rendition.width}p`;
    console.log(`  encoding ${name} @ ${rendition.bitrate}`);
    await run("ffmpeg", [
      "-y", "-i", input,
      "-vf", `scale=w=${rendition.width}:h=${rendition.height}:force_original_aspect_ratio=decrease,pad=${rendition.width}:${rendition.height}:(ow-iw)/2:(oh-ih)/2`,
      "-c:a", "aac", "-ar", "48000", "-b:a", rendition.audio,
      "-c:v", "h264", "-profile:v", "main", "-crf", "20", "-sc_threshold", "0",
      // Keyframe every segment: a player can only switch rendition at a keyframe.
      "-g", String(SEGMENT_SECONDS * 30), "-keyint_min", String(SEGMENT_SECONDS * 30),
      "-b:v", rendition.bitrate, "-maxrate", rendition.maxrate, "-bufsize", rendition.bufsize,
      "-hls_time", String(SEGMENT_SECONDS),
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(outDir, `${name}_%03d.ts`),
      path.join(outDir, `${name}.m3u8`),
    ]);
  }

  const master = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    ...ladder.flatMap((r) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(r.bitrate) * 1000},RESOLUTION=${r.width}x${r.height}`,
      `${r.width}p.m3u8`,
    ]),
  ].join("\n");

  await fs.writeFile(path.join(outDir, "master.m3u8"), `${master}\n`, "utf8");
  console.log(`✓ master playlist → ${path.join(outDir, "master.m3u8")}`);

  if (args.upload) {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      console.error("✗ --upload needs S3_BUCKET (and credentials) in the environment");
      process.exit(1);
    }
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.S3_REGION ?? "ap-south-1",
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });

    const files = await fs.readdir(outDir);
    for (const file of files) {
      const key = `hls/${id}/${file}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: await fs.readFile(path.join(outDir, file)),
          ContentType: file.endsWith(".m3u8")
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t",
          // Segments are immutable; the manifest is small and revalidates.
          CacheControl: file.endsWith(".m3u8") ? "max-age=60" : "max-age=31536000, immutable",
        }),
      );
      process.stdout.write(".");
    }
    const base = process.env.S3_PUBLIC_BASE_URL ?? `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com`;
    console.log(`\n✓ uploaded ${files.length} objects`);
    console.log(`  hlsUrl: ${base.replace(/\/$/, "")}/hls/${id}/master.m3u8`);
  }
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
