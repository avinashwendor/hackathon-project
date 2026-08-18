import type { Metadata } from "next";
import { CATALOG_REELS, FEED_REELS } from "@/data/reels";
import { AppShell } from "@/components/app/app-shell";
import { FeedExperience } from "@/components/feed/feed-experience";
import { requireAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reels",
  description: "Watch reels. The agent reads why you watched.",
};

export default async function ReelsPage() {
  await requireAccount("/reels");
  const seeded = [
    ...FEED_REELS,
    ...CATALOG_REELS.filter((r) => ["cat-dsa-twopointer", "cat-cloud-docker-layers"].includes(r.id)),
  ];

  return (
    <AppShell variant="reels">
      <FeedExperience initialReels={seeded} />
    </AppShell>
  );
}
