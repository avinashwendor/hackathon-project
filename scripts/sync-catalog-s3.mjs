#!/usr/bin/env node
/**
 * Upload imported catalog MP4s to S3 (or R2) using the keys in catalog.json.
 *
 *   cp .env.local .env   # or export S3_* vars
 *   node scripts/sync-catalog-s3.mjs --dir "/path/to/ingest/output"
 *   node scripts/sync-catalog-s3.mjs --dir "..." --dry-run
 *   node scripts/sync-catalog-s3.mjs --dir "..." --limit 5
 *
 * Each reel already has:
 *   media.storageKey  →  S3 object key (e.g. reels/reel_000001/foo.mp4)
 *   media.localFile     →  path under the ingest agent output dir
 *
 * After upload, set on Railway:
 *   STORAGE_DRIVER=s3
 *   S3_BUCKET=...
 *   S3_PUBLIC_BASE_URL=https://your-cdn-or-r2.dev/...
 *   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
 *   (S3_ENDPOINT + S3_FORCE_PATH_STYLE=true for Cloudflare R2)
 */

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs();
const SOURCE_DIR = args.dir ?? process.env.REELS_CATALOG_DIR ?? "";
const DRY = Boolean(args["dry-run"]);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const CONCURRENCY = Number(args.concurrency ?? 4);

const BUCKET = process.env.S3_BUCKET ?? "";
const REGION = process.env.S3_REGION ?? "ap-south-1";
const ENDPOINT = process.env.S3_ENDPOINT ?? "";
const FORCE_PATH = process.env.S3_FORCE_PATH_STYLE === "true";
const ACCESS = process.env.S3_ACCESS_KEY_ID ?? "";
const SECRET = process.env.S3_SECRET_ACCESS_KEY ?? "";

if (!SOURCE_DIR) {
  console.error("✗ Pass --dir <ingest-agent-output> or set REELS_CATALOG_DIR");
  process.exit(1);
}
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

const catalogPath = path.resolve("data/generated/catalog.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const reels = catalog.reels.filter((r) => r.media?.storageKey && r.media?.localFile).slice(0, LIMIT);

console.log(`Catalog: ${catalog.reels.length} reels, uploading ${reels.length}${DRY ? " (dry run)" : ""}`);
console.log(`Source:  ${path.resolve(SOURCE_DIR)}`);
console.log(`Bucket:  ${BUCKET}${ENDPOINT ? ` @ ${ENDPOINT}` : ""}\n`);

async function exists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadOne(reel) {
  const key = reel.media.storageKey;
  const localPath = path.join(SOURCE_DIR, reel.media.localFile);

  try {
    await fs.access(localPath);
  } catch {
    return { id: reel.id, key, status: "missing", localPath };
  }

  if (!DRY && (await exists(key))) {
    return { id: reel.id, key, status: "skipped" };
  }

  if (DRY) {
    return { id: reel.id, key, status: "would-upload", localPath };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { id: reel.id, key, status: "uploaded" };
}

let uploaded = 0;
let skipped = 0;
let missing = 0;

for (let i = 0; i < reels.length; i += CONCURRENCY) {
  const batch = reels.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(uploadOne));
  for (const r of results) {
    if (r.status === "uploaded" || r.status === "would-upload") uploaded++;
    else if (r.status === "skipped") skipped++;
    else if (r.status === "missing") {
      missing++;
      console.warn(`  ✗ missing file: ${r.localPath}`);
    }
  }
  process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, reels.length)}/${reels.length}`);
}

console.log(`\n\nDone.${DRY ? " (dry run — nothing uploaded)" : ""}`);
console.log(`  uploaded: ${uploaded}`);
console.log(`  skipped (already in bucket): ${skipped}`);
console.log(`  missing local files: ${missing}`);

if (!DRY && uploaded + skipped > 0) {
  const base =
    process.env.S3_PUBLIC_BASE_URL ??
    (ENDPOINT
      ? `${ENDPOINT.replace(/\/$/, "")}/${BUCKET}`
      : `https://${BUCKET}.s3.${REGION}.amazonaws.com`);
  console.log(`\nSet on Railway:`);
  console.log(`  STORAGE_DRIVER=s3`);
  console.log(`  S3_PUBLIC_BASE_URL=${base.replace(/\/$/, "")}`);
  console.log(`\nVerify: curl https://YOUR-APP/api/health → storage.objectStorage.ok true`);
}

if (missing > 0) process.exit(1);
