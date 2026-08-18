import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prefetchFeed } from "@/lib/feed/build-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 5;

/** Paginated personalized feed — 5 playable reels at a time, skips watched/seen. */
export async function GET(request: Request) {
  const { sessionId, account } = await getViewer();
  if (!account) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || PAGE_SIZE, 10);
  const excludeParam = url.searchParams.get("exclude") ?? "";
  const excludeIds = excludeParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const refresh = url.searchParams.get("refresh") === "1";

  const result = await prefetchFeed(sessionId, { limit, excludeIds, refresh });

  return NextResponse.json(result);
}
