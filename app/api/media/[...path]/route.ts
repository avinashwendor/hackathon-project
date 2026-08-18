import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
   Development-only video streaming.

   Serves the ingest agent's MP4s straight off disk so the real reels play
   locally without uploading a gigabyte first. It is disabled outside
   development, and every path is resolved and re-checked against the configured
   root before a handle is opened — the classic `../../` escape is the whole
   risk with a route shaped like this.

   Range requests are honoured because a <video> element issues one immediately;
   without a 206 the browser downloads the entire file before showing a frame.
--------------------------------------------------------------------------- */

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!config.media.serveLocal) {
    return new Response("Local media serving is disabled", { status: 404 });
  }

  const root = path.resolve(config.media.catalogDir);
  const { path: segments } = await context.params;
  const requested = path.resolve(root, ...segments.map((s) => decodeURIComponent(s)));

  // Containment check on the resolved path, not on the raw input.
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  const extension = path.extname(requested).toLowerCase();
  if (!CONTENT_TYPES[extension]) {
    return new Response("Unsupported media type", { status: 415 });
  }

  let stat;
  try {
    stat = await fs.stat(requested);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[extension];
  const range = request.headers.get("range");

  if (!range) {
    const stream = Readable.toWeb(createReadStream(requested)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? Number(match[1]) : 0;
  // Cap the chunk: a vertical feed seeks constantly and 1MB is plenty to keep
  // playback smooth without pulling a whole 20MB reel on the first request.
  const requestedEnd = match?.[2] ? Number(match[2]) : start + 1_048_575;
  const end = Math.min(requestedEnd, stat.size - 1);

  if (start >= stat.size || start > end) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }

  const stream = Readable.toWeb(createReadStream(requested, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
