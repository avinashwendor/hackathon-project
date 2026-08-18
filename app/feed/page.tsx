import type { Metadata } from "next";
import { CATALOG_REELS, FEED_REELS } from "@/data/reels";
import { AppShell } from "@/components/app/app-shell";
import { HomeFeed } from "@/components/feed/home-feed";
import { requireAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed",
  description: "Your Upstream feed.",
};

export default async function FeedPage() {
  await requireAccount("/feed");
  const posts = [...FEED_REELS, ...CATALOG_REELS.slice(0, 18)];

  return (
    <AppShell>
      <HomeFeed posts={posts} />
    </AppShell>
  );
}
