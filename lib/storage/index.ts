import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";

/* ---------------------------------------------------------------------------
   Media storage.

   Uploads never pass through the app server. The server signs a short-lived,
   single-object PUT and the browser talks to storage directly — a 200MB reel
   would otherwise hold a request open for minutes and bill the bandwidth twice.

   The local driver exists so the studio works before any bucket is configured;
   it writes into /public and is honest about being development-only.
--------------------------------------------------------------------------- */

export interface PresignResult {
  /** Where the browser should PUT the bytes. */
  uploadUrl: string;
  /** How the upload must be sent — the local driver needs a form POST. */
  method: "PUT" | "POST";
  key: string;
  /** Where the object will be readable once uploaded. */
  publicUrl: string;
  driver: string;
  expiresInSec: number;
  headers?: Record<string, string>;
}

const LOCAL_DIR = path.join(process.cwd(), "public", "media", "uploads");

export function storageDriver(): "s3" | "local" {
  return config.storage.driver === "s3" && config.storage.bucket ? "s3" : "local";
}

export function objectKey(filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  const stamp = Date.now().toString(36);
  return `${config.storage.uploadPrefix}/${stamp}-${safe || "reel.mp4"}`;
}

export function publicUrlFor(key: string): string {
  if (storageDriver() === "local") return `/media/uploads/${path.basename(key)}`;
  if (config.storage.publicBaseUrl) {
    return `${config.storage.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  if (config.storage.endpoint) {
    return `${config.storage.endpoint.replace(/\/$/, "")}/${config.storage.bucket}/${key}`;
  }
  return `https://${config.storage.bucket}.s3.${config.storage.region}.amazonaws.com/${key}`;
}

export async function presignUpload(filename: string, contentType: string): Promise<PresignResult> {
  const key = objectKey(filename);

  if (storageDriver() === "local") {
    return {
      uploadUrl: "/api/upload/local",
      method: "POST",
      key,
      publicUrl: publicUrlFor(key),
      driver: "local:public-dir",
      expiresInSec: 0,
    };
  }

  // Imported lazily so a deployment with no bucket never loads the AWS SDK.
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: config.storage.region,
    ...(config.storage.endpoint ? { endpoint: config.storage.endpoint } : {}),
    forcePathStyle: config.storage.forcePathStyle,
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  });

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: config.storage.presignExpirySec },
  );

  return {
    uploadUrl,
    method: "PUT",
    key,
    publicUrl: publicUrlFor(key),
    driver: `s3:${config.storage.bucket}`,
    expiresInSec: config.storage.presignExpirySec,
    headers: { "Content-Type": contentType },
  };
}

/** Development-only sink for the local driver. */
export async function writeLocalObject(key: string, bytes: ArrayBuffer): Promise<string> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const filename = path.basename(key);
  await fs.writeFile(path.join(LOCAL_DIR, filename), Buffer.from(bytes));
  return `/media/uploads/${filename}`;
}
