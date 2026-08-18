import { NextResponse } from "next/server";
import { ALL_REELS, CATALOG_REELS, FEED_REELS } from "@/data/reels";
import { CATEGORIES, type Category } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lane = url.searchParams.get("lane");
  const categoryParam = url.searchParams.get("category");
  const category = CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : undefined;

  let reels = lane === "feed" ? FEED_REELS : lane === "catalog" ? CATALOG_REELS : ALL_REELS;
  if (category) reels = reels.filter((r) => r.category === category);

  return NextResponse.json({ count: reels.length, reels });
}
