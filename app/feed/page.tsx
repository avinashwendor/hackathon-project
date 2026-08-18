import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { HomeFeed } from "@/components/feed/home-feed";
import { requireAccount } from "@/lib/auth";
import { prefetchFeed } from "@/lib/feed/build-feed";
import { readSocial } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed",
  description: "Your Upstream feed.",
};

export default async function FeedPage() {
  const viewer = await requireAccount("/feed");
  const social = await readSocial(viewer.sessionId);
  if (!social.onboarding?.completedAt) redirect("/onboarding");

  const initial = await prefetchFeed(viewer.sessionId, { limit: 5 });

  return (
    <AppShell>
      <HomeFeed
        initialReels={initial.reels}
        initialSource={initial.source}
        initialHasMore={initial.hasMore}
      />
    </AppShell>
  );
}
