#!/usr/bin/env node
/**
 * Upload login/signup phone preview assets to S3 (same bucket as reel MP4s).
 *
 *   cp .env.local .env   # or export S3_* vars
 *   npm run sync:auth-s3
 *   npm run sync:auth-s3 -- --dry-run
 *
 * Objects:
 *   auth/feed-preview.webm
 *   auth/feed-preview-poster.webp
 *
 * After upload, Railway serves them via /api/media/s3/auth/... (see lib/media.ts).
 */

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const DRY = process.argv.includes("--dry-run");

const BUCKET = process.env.S3_BUCKET ?? "";
const REGION = process.env.S3_REGION ?? "ap-south-1";
const ENDPOINT = process.env.S3_ENDPOINT ?? "";
const FORCE_PATH = process.env.S3_FORCE_PATH_STYLE === "true";
const ACCESS = process.env.S3_ACCESS_KEY_ID ?? "";
const SECRET = process.env.S3_SECRET_ACCESS_KEY ?? "";

const ASSETS = [
  {
    key: "auth/feed-preview.webm",
    local: "public/auth/feed-preview.webm",
    contentType: "video/webm",
  },
  {
    key: "auth/feed-preview-poster.webp",
    local: "public/auth/feed-preview-poster.webp",
    contentType: "image/webp",
  },
];

if (!BUCKET || !ACCESS || !SECRET) {
  console.error("✗ Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
  process.exit(1);
}

const client = new S3Client({
  region: REGION,
  ...(ENDPOINT ? { endpoint: ENDPOINT } : {}),
  forcePathStyle: FORCE_PATH,
  credentials: { accessKeyId: ACCESS, secretAccessKey: SECRET },
});

async function exists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

console.log(`Auth preview upload${DRY ? " (dry run)" : ""}`);
console.log(`Bucket: ${BUCKET}${ENDPOINT ? ` @ ${ENDPOINT}` : ""}\n`);

let uploaded = 0;
let skipped = 0;
let missing = 0;

for (const asset of ASSETS) {
  const localPath = path.resolve(asset.local);
  try {
    await fs.access(localPath);
  } catch {
    missing++;
    console.warn(`  ✗ missing local file: ${localPath}`);
    continue;
  }

  if (!DRY && (await exists(asset.key))) {
    skipped++;
    console.log(`  ○ ${asset.key} (already in bucket)`);
    continue;
  }

  if (DRY) {
    uploaded++;
    console.log(`  → would upload ${asset.key} ← ${localPath}`);
    continue;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: asset.key,
      Body: createReadStream(localPath),
      ContentType: asset.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  uploaded++;
  console.log(`  ✓ ${asset.key}`);
}

console.log(`\nDone.${DRY ? " (dry run — nothing uploaded)" : ""}`);
console.log(`  uploaded: ${uploaded}`);
console.log(`  skipped: ${skipped}`);
console.log(`  missing: ${missing}`);

if (missing > 0) process.exit(1);

if (!DRY && (uploaded > 0 || skipped > 0)) {
  console.log("\nPlayback on Railway (when S3_* vars are set):");
  console.log("  /api/media/s3/auth/feed-preview.webm");
  console.log("  /api/media/s3/auth/feed-preview-poster.webp");
}
