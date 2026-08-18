import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ExploreExperience } from "@/components/explore/explore-experience";
import { requireAccount } from "@/lib/auth";
import { prefetchFeed } from "@/lib/feed/build-feed";
import { readSocial } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover reels.",
};

export default async function ExplorePage() {
  const viewer = await requireAccount("/explore");
  const social = await readSocial(viewer.sessionId);
  if (!social.onboarding?.completedAt) redirect("/onboarding");

  const initial = await prefetchFeed(viewer.sessionId, { limit: 24 });

  return (
    <AppShell>
      <ExploreExperience initialReels={initial.reels} feedSource={initial.source} />
    </AppShell>
  );
}
