import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "@/lib/config";
import { storageDriver } from "@/lib/storage";

let client: S3Client | null = null;

function getClient(): S3Client | null {
  if (storageDriver() !== "s3" || !config.storage.bucket || !config.storage.accessKeyId) {
    return null;
  }
  if (!client) {
    client = new S3Client({
      region: config.storage.region,
      ...(config.storage.endpoint ? { endpoint: config.storage.endpoint } : {}),
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    });
  }
  return client;
}

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Stream an object from the configured bucket with HTTP range support. */
export async function streamStorageObject(
  key: string,
  rangeHeader: string | null,
): Promise<Response> {
  const s3 = getClient();
  if (!s3) return new Response("Object storage not configured", { status: 503 });

  let size: number;
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: config.storage.bucket, Key: key }),
    );
    size = head.ContentLength ?? 0;
    if (!size) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const contentType = contentTypeForKey(key);

  if (!rangeHeader) {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }),
    );
    return new Response(obj.Body as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  const start = match?.[1] ? Number(match[1]) : 0;
  const requestedEnd = match?.[2] ? Number(match[2]) : start + 1_048_575;
  const end = Math.min(requestedEnd, size - 1);

  if (start >= size || start > end) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Range: `bytes=${start}-${end}`,
    }),
  );

  return new Response(obj.Body as ReadableStream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
