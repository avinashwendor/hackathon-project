import type { Metadata } from "next";
import Link from "next/link";
import { CATALOG_REELS, FEED_REELS } from "@/data/reels";
import { AppShell } from "@/components/app/app-shell";
import { ReelPoster } from "@/components/catalog/reel-tile";
import { requireAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover reels.",
};

export default async function ExplorePage() {
  await requireAccount("/explore");
  const reels = [...FEED_REELS, ...CATALOG_REELS].slice(0, 36);

  return (
    <AppShell>
      <div className="mx-auto max-w-[935px] px-0 py-0 lg:px-8 lg:py-8">
        <div className="grid grid-cols-3 gap-[2px] lg:gap-1">
          {reels.map((reel, i) => (
            <Link
              key={reel.id}
              href="/reels"
              className={i % 12 === 2 ? "row-span-2" : ""}
            >
              <ReelPoster
                reel={reel}
                className={i % 12 === 2 ? "h-full min-h-[240px] w-full rounded-none" : "aspect-square w-full rounded-none"}
              />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
