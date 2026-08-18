import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { FeedExperience } from "@/components/feed/feed-experience";
import { requireAccount } from "@/lib/auth";
import { getReel } from "@/data/reels";
import { withResolvedMedia } from "@/lib/media";
import { prefetchFeed } from "@/lib/feed/build-feed";
import { readSocial } from "@/lib/store";

interface ReelsPageProps {
  searchParams: Promise<{ reel?: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reels",
  description: "Watch reels. The agent reads why you watched.",
};

export default async function ReelsPage({ searchParams }: ReelsPageProps) {
  const viewer = await requireAccount("/reels");
  const social = await readSocial(viewer.sessionId);
  if (!social.onboarding?.completedAt) redirect("/onboarding");

  const { reel: startReelId } = await searchParams;
  const initial = await prefetchFeed(viewer.sessionId, { limit: 2 });

  let reels = initial.reels;
  if (startReelId) {
    const target = getReel(startReelId);
    if (target?.media.storageKey) {
      const resolved = withResolvedMedia(target);
      reels = [resolved, ...initial.reels.filter((r) => r.id !== startReelId)];
    }
  }

  return (
    <AppShell variant="reels">
      <FeedExperience initialReels={reels} initialHasMore={initial.hasMore} />
    </AppShell>
  );
}
