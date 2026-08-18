import { streamStorageObject } from "@/lib/storage/stream-object";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
   Private-bucket playback proxy.

   Railway (and most S3-compatible) buckets are private — direct URLs 403.
   The app streams objects with server credentials and honours Range requests
   so <video> seeking works. Point S3_PUBLIC_BASE_URL at:

     https://YOUR-APP/api/media/s3

   and resolveMedia() will build keys as /api/media/s3/reels/...
--------------------------------------------------------------------------- */

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  if (!segments?.length) return new Response("Not found", { status: 404 });

  const key = segments.map((s) => decodeURIComponent(s)).join("/");
  if (key.includes("..")) return new Response("Forbidden", { status: 403 });

  return streamStorageObject(key, request.headers.get("range"));
}
