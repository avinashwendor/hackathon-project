import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { config } from "@/lib/config";
import { storageDriver } from "@/lib/storage";

export interface StorageHealth {
  driver: "s3" | "local";
  configured: boolean;
  bucket?: string;
  publicBaseUrl?: string;
  ok: boolean;
  sampleKey?: string;
  error?: string;
}

function s3Client(): S3Client | null {
  if (!config.storage.bucket || !config.storage.accessKeyId) return null;
  return new S3Client({
    region: config.storage.region,
    ...(config.storage.endpoint ? { endpoint: config.storage.endpoint } : {}),
    forcePathStyle: config.storage.forcePathStyle,
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  });
}

/** Ping the configured bucket — used by /api/health. */
export async function storageHealth(sampleKey?: string): Promise<StorageHealth> {
  const driver = storageDriver();
  const base: StorageHealth = {
    driver,
    configured: driver === "s3",
    bucket: config.storage.bucket || undefined,
    publicBaseUrl: config.storage.publicBaseUrl || undefined,
    ok: driver === "local",
  };

  if (driver !== "s3") return base;

  const client = s3Client();
  if (!client) {
    return { ...base, ok: false, error: "S3_BUCKET or S3_ACCESS_KEY_ID missing" };
  }

  try {
    if (sampleKey) {
      await client.send(
        new HeadObjectCommand({ Bucket: config.storage.bucket, Key: sampleKey }),
      );
      return { ...base, ok: true, sampleKey };
    }

    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: config.storage.bucket, MaxKeys: 1 }),
    );
    return {
      ...base,
      ok: (listed.KeyCount ?? 0) > 0,
      error: (listed.KeyCount ?? 0) > 0 ? undefined : "Bucket is empty — run npm run sync:s3",
    };
  } catch (err) {
    return {
      ...base,
      ok: false,
      sampleKey,
      error: (err as Error).message.slice(0, 200),
    };
  }
}
