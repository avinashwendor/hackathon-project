"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Grid3x3, Bookmark, Settings } from "lucide-react";
import { CATALOG_REELS } from "@/data/reels";
import { useViewer } from "@/components/auth/use-viewer";
import { TasteDashboard } from "@/components/profile/taste-dashboard";
import { ReelPoster } from "@/components/catalog/reel-tile";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Tab = "posts" | "saved" | "taste";

export function InstagramProfile() {
  const { viewer, loading } = useViewer();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("posts");
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (loading || !viewer.account) {
    return <div className="px-4 py-20 text-center text-fg-muted">Loading profile…</div>;
  }

  const account = viewer.account;
  const handle = account.name.replace(/\s+/g, "").toLowerCase();
  const posts = CATALOG_REELS.slice(0, 9);

  return (
    <div className="mx-auto max-w-[935px] px-4 py-8 lg:px-8">
      <div className="flex gap-6 sm:gap-16">
        <Avatar name={account.name} hue={24} size={86} className="sm:size-[150px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[20px] font-normal">{handle}</h1>
            <Link
              href="/studio"
              className="rounded-lg bg-white/10 px-4 py-1.5 text-[14px] font-semibold"
            >
              Create
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="rounded-lg bg-white/10 px-4 py-1.5 text-[14px] font-semibold"
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
            <Settings className="size-5" aria-hidden />
          </div>

          <ul className="mt-6 flex gap-8 text-[16px]">
            <li>
              <span className="font-semibold">{viewer.watchedCount}</span>{" "}
              <span className="text-fg-muted">watched</span>
            </li>
            <li>
              <span className="font-semibold">{viewer.follows.length}</span>{" "}
              <span className="text-fg-muted">following</span>
            </li>
            <li>
              <span className="font-semibold">{Math.max(viewer.eventCount, 12)}</span>{" "}
              <span className="text-fg-muted">signals</span>
            </li>
          </ul>

          <p className="mt-5 text-[14px] font-semibold">{account.name}</p>
          <p className="text-[14px] text-fg-muted">{account.email}</p>
          <p className="mt-2 max-w-[48ch] text-[14px] leading-5">
            Building skills in sixty-second bursts. The feed learns why you watch — not just what.
          </p>
        </div>
      </div>

      <div className="mt-10 flex justify-around border-t border-line text-[12px] font-semibold tracking-[0.16em] uppercase">
        {(
          [
            ["posts", "Posts", Grid3x3],
            ["saved", "Saved", Bookmark],
            ["taste", "Taste", Settings],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mt-px flex items-center gap-2 border-t py-3.5",
              tab === id ? "border-fg text-fg" : "border-transparent text-fg-muted",
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "taste" ? (
        <div className="mt-6 rounded-xl bg-[#fbf8f5] p-4 text-[#0f172a]">
          <TasteDashboard />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px] lg:gap-1">
          {(tab === "saved" ? posts.slice(3, 9) : posts).map((reel) => (
            <Link key={reel.id} href="/reels">
              <ReelPoster reel={reel} className="aspect-square w-full rounded-none" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
