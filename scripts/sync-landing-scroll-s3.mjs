#!/usr/bin/env node
/**
 * Upload scroll-scrub landing frames to S3 (TripNine-style hero).
 *
 *   npm run sync:landing-s3
 *   npm run sync:landing-s3 -- --force
 *
 * Objects: landing/scroll-sequence/frame_0001.webp … frame_0120.webp
 * Served via /api/media/s3/landing/scroll-sequence/… when S3_* vars are set.
 */

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry-run");
const FRAME_COUNT = 120;
const LOCAL_DIR = path.resolve("public/landing/scroll-sequence");
const S3_PREFIX = "landing/scroll-sequence";

const BUCKET = process.env.S3_BUCKET ?? "";
const REGION = process.env.S3_REGION ?? "ap-south-1";
const ENDPOINT = process.env.S3_ENDPOINT ?? "";
const FORCE_PATH = process.env.S3_FORCE_PATH_STYLE === "true";
const ACCESS = process.env.S3_ACCESS_KEY_ID ?? "";
const SECRET = process.env.S3_SECRET_ACCESS_KEY ?? "";

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

console.log(`Landing scroll frames${DRY ? " (dry run)" : ""}`);
console.log(`Bucket: ${BUCKET}${ENDPOINT ? ` @ ${ENDPOINT}` : ""}\n`);

let uploaded = 0;
let skipped = 0;
let missing = 0;

for (let i = 1; i <= FRAME_COUNT; i++) {
  const frameNum = String(i).padStart(4, "0");
  const name = `frame_${frameNum}.webp`;
  const key = `${S3_PREFIX}/${name}`;
  const localPath = path.join(LOCAL_DIR, name);

  try {
    await fs.access(localPath);
  } catch {
    missing++;
    if (missing <= 3) console.warn(`  ✗ missing ${localPath}`);
    continue;
  }

  if (!DRY && !FORCE && (await exists(key))) {
    skipped++;
    if (skipped <= 2 || i === FRAME_COUNT) {
      if (i === FRAME_COUNT && skipped > 2) console.log(`  ○ … ${skipped} frames already in bucket`);
    }
    continue;
  }

  if (DRY) {
    uploaded++;
    if (uploaded <= 2 || i === FRAME_COUNT) console.log(`  → would upload ${key}`);
    continue;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  uploaded++;
  if (uploaded % 20 === 0 || i === FRAME_COUNT) console.log(`  ✓ ${uploaded}/${FRAME_COUNT - skipped - missing} uploaded…`);
}

console.log(`\nDone.${DRY ? " (dry run)" : ""}`);
console.log(`  uploaded: ${uploaded}`);
console.log(`  skipped: ${skipped}`);
console.log(`  missing: ${missing}`);

if (missing > 0) process.exit(1);

if (!DRY) {
  console.log("\nLanding hero frames:");
  console.log("  /api/media/s3/landing/scroll-sequence/frame_0001.webp");
}
