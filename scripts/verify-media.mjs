#!/usr/bin/env node
/**
 * Report embedding cache coverage and S3 media readiness.
 *
 *   node scripts/verify-media.mjs
 *   node scripts/verify-media.mjs --check-s3   # HEAD first catalog object
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const checkS3 = process.argv.includes("--check-s3");
const catalog = JSON.parse(await fs.readFile("data/generated/catalog.json", "utf8"));
const embFiles = (await fs.readdir("data/generated")).filter((f) => f.startsWith("embeddings."));
const embPath = embFiles.sort().at(-1);
const emb = embPath ? JSON.parse(await fs.readFile(`data/generated/${embPath}`, "utf8")) : null;

const withKey = catalog.reels.filter((r) => r.media?.storageKey);
const withHls = catalog.reels.filter((r) => r.media?.hlsUrl);

console.log("── Catalog ──");
console.log(`  reels in catalog.json:     ${catalog.reels.length}`);
console.log(`  with S3 storageKey:        ${withKey.length}`);
console.log(`  with HLS master:           ${withHls.length}`);

console.log("\n── Embeddings ──");
if (emb) {
  console.log(`  cache file:                data/generated/${embPath}`);
  console.log(`  provider:                  ${emb.provider}`);
  console.log(`  dimensions:                ${emb.dims}`);
  console.log(`  vectors cached:            ${Object.keys(emb.vectors).length}`);
  const missing = catalog.reels.filter((r) => !emb.vectors[r.id]).map((r) => r.id);
  if (missing.length) console.log(`  catalog reels NOT embedded: ${missing.length}`);
  else console.log(`  ✓ all catalog reels embedded`);
} else {
  console.log("  ✗ no embedding cache — run: GEMINI_API_KEY=... npm run embed");
}

console.log("\n── Railway S3 ──");
const pub = process.env.S3_PUBLIC_BASE_URL;
const bucket = process.env.S3_BUCKET;
if (!bucket) {
  console.log("  S3 not configured in env (set S3_BUCKET to test)");
} else {
  console.log(`  bucket:                    ${bucket}`);
  console.log(`  public base:               ${pub ?? "(not set — mp4 URLs will not resolve)"}`);
  if (withKey[0]) {
    const sample = withKey[0].media.storageKey;
    const url = pub ? `${pub.replace(/\/$/, "")}/${sample}` : null;
    console.log(`  sample key:                ${sample}`);
    if (url) console.log(`  sample URL:                ${url}`);
  }
}

if (checkS3 && bucket && process.env.S3_ACCESS_KEY_ID) {
  const { S3Client, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: process.env.S3_REGION ?? "ap-south-1",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const key = withKey[0]?.media?.storageKey;
  if (key) {
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      console.log(`\n  ✓ S3 object exists (${head.ContentLength} bytes)`);
    } catch (err) {
      console.log(`\n  ✗ S3 HEAD failed: ${err.message}`);
      console.log("    Run: npm run sync:s3 -- --dir <ingest-output>");
    }
  }
}

console.log("\n── Next steps ──");
console.log("  1. npm run sync:s3 -- --dir <ingest-agent-output>");
console.log("  2. Set S3_PUBLIC_BASE_URL on Railway");
console.log("  3. curl /api/health → media.playable should match catalog count");
