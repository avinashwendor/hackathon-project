"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Grid3x3, History, Sparkles, ThumbsDown } from "lucide-react";
import { getReel, resolveReelsMedia } from "@/data/reels";
import { MOTIVATIONS, TOPIC_BY_ID } from "@/data/ontology";
import { ONBOARDING_CLUSTERS } from "@/lib/onboarding/catalog-options";
import { dislikeReasonLabel } from "@/lib/social/dislike-reasons";
import type { OnboardingPreferences, SocialState } from "@/lib/store/types";
import { useSignOut } from "@/components/auth/use-sign-out";
import { TasteDashboard } from "@/components/profile/taste-dashboard";
import { reelThumbnailSrc, ReelThumbnail } from "@/components/catalog/reel-thumbnail";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Tab = "posts" | "saved" | "watched" | "disliked" | "taste";

export interface ProfileAccount {
  id: string;
  email: string;
  name: string;
}

export interface ProfileStats {
  eventCount: number;
  watchedCount: number;
}

export function InstagramProfile({
  account,
  social: initialSocial,
  stats,
}: {
  account: ProfileAccount;
  social: SocialState;
  stats: ProfileStats;
}) {
  const [tab, setTab] = useState<Tab>("posts");
  const { signOut, signingOut } = useSignOut();
  const [social, setSocial] = useState(initialSocial);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  const refreshSocial = useCallback(async () => {
    try {
      const [socialRes, eventsRes] = await Promise.all([
        fetch("/api/social", { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
      ]);
      if (socialRes.ok) {
        const json = (await socialRes.json()) as { social: SocialState };
        setSocial({
          ...initialSocial,
          ...json.social,
          dislikeFeedback: json.social.dislikeFeedback ?? {},
          seenReels: json.social.seenReels ?? [],
        });
      }
      if (eventsRes.ok) {
        const json = (await eventsRes.json()) as { events: { reelId: string }[] };
        const ids = [...new Set((json.events ?? []).map((e) => e.reelId))];
        setWatchedIds(ids.reverse());
      }
    } catch {
      // Keep server-rendered snapshot.
    }
  }, [initialSocial]);

  useEffect(() => {
    void refreshSocial();
    const onFocus = () => void refreshSocial();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSocial]);

  const logout = () => void signOut();

  const handle = account.name.replace(/\s+/g, "").toLowerCase();
  const likedReels = resolveReelsMedia(
    social.likes.map((id) => getReel(id)).filter(Boolean) as NonNullable<ReturnType<typeof getReel>>[],
  );
  const savedReels = resolveReelsMedia(
    social.saves.map((id) => getReel(id)).filter(Boolean) as NonNullable<ReturnType<typeof getReel>>[],
  );
  const dislikedReels = resolveReelsMedia(
    social.dislikes.map((id) => getReel(id)).filter(Boolean) as NonNullable<ReturnType<typeof getReel>>[],
  );
  const watchedReels = resolveReelsMedia(
    watchedIds.map((id) => getReel(id)).filter(Boolean) as NonNullable<ReturnType<typeof getReel>>[],
  );

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
              onClick={logout}
              disabled={signingOut}
              className="rounded-lg bg-white/10 px-4 py-1.5 text-[14px] font-semibold"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[16px]">
            <li>
              <span className="font-semibold">{likedReels.length}</span>{" "}
              <span className="text-fg-muted">liked</span>
            </li>
            <li>
              <span className="font-semibold">{savedReels.length}</span>{" "}
              <span className="text-fg-muted">saved</span>
            </li>
            <li>
              <span className="font-semibold">{stats.watchedCount}</span>{" "}
              <span className="text-fg-muted">watched</span>
            </li>
            <li>
              <span className="font-semibold">{social.follows.length}</span>{" "}
              <span className="text-fg-muted">following</span>
            </li>
          </ul>

          <p className="mt-5 text-[14px] font-semibold">{account.name}</p>
          <p className="text-[14px] text-fg-muted">{account.email}</p>
          {social.onboarding && <OnboardingSummary prefs={social.onboarding} />}
        </div>
      </div>

      <div className="mt-10 flex justify-around border-t border-line text-[12px] font-semibold tracking-[0.16em] uppercase">
        {(
          [
            ["posts", "Liked", Grid3x3],
            ["saved", "Saved", Bookmark],
            ["watched", "Watched", History],
            ["disliked", "Passed", ThumbsDown],
            ["taste", "Taste", Sparkles],
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
        <div className="mt-6">
          <TasteDashboard />
        </div>
      ) : tab === "saved" ? (
        <ReelGrid reels={savedReels} empty="Save reels from your feed to see them here." />
      ) : tab === "disliked" ? (
        <DislikedList reels={dislikedReels} feedback={social.dislikeFeedback ?? {}} />
      ) : tab === "watched" ? (
        <ReelGrid
          reels={watchedReels}
          empty="Reels you watch appear here — they won't repeat in your feed."
        />
      ) : (
        <ReelGrid reels={likedReels} empty="Like reels in your feed — they'll show up here." />
      )}
    </div>
  );
}

function OnboardingSummary({ prefs }: { prefs: OnboardingPreferences }) {
  const motivation =
    MOTIVATIONS[prefs.motivation as keyof typeof MOTIVATIONS] ?? prefs.motivation;
  const clusterLabels = (prefs.clusters ?? [])
    .map((id) => ONBOARDING_CLUSTERS.find((c) => c.id === id)?.label ?? id)
    .join(", ");
  const topicLabels = prefs.topics
    .map((id) => TOPIC_BY_ID.get(id)?.label ?? id)
    .slice(0, 4)
    .join(", ");

  return (
    <p className="mt-2 max-w-[48ch] text-[14px] leading-5 text-fg-muted">
      {clusterLabels && (
        <>
          <span className="text-fg">{clusterLabels}</span>
          <br />
        </>
      )}
      {topicLabels && <>Topics: {topicLabels} · </>}
      {prefs.difficulty} · {motivation}
      {prefs.goal ? (
        <>
          <br />
          &ldquo;{prefs.goal}&rdquo;
        </>
      ) : null}
    </p>
  );
}

function DislikedList({
  reels,
  feedback,
}: {
  reels: ReturnType<typeof resolveReelsMedia>;
  feedback: SocialState["dislikeFeedback"];
}) {
  if (!reels.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] text-fg-muted">
          Reels you pass on — with your reason — appear here and shape your feed.
        </p>
        <Link href="/feed" className="mt-4 inline-block text-[14px] font-semibold text-[#0095f6]">
          Go to feed
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {reels.map((reel) => {
        const fb = feedback[reel.id];
        return (
          <li
            key={reel.id}
            className="flex gap-4 rounded-lg border border-line p-3 sm:items-center"
          >
            <Link href={`/reels?reel=${encodeURIComponent(reel.id)}`} className="shrink-0">
              <ReelThumbnail reel={reel} className="size-20 rounded-md sm:size-24" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold line-clamp-2">{reel.title}</p>
              <p className="mt-1 text-[13px] text-fg-muted">{reel.category}</p>
              {fb && (
                <p className="mt-2 text-[13px] text-fg-subtle">
                  Reason: {dislikeReasonLabel(fb.reason)}
                  {fb.detail ? ` — “${fb.detail}”` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReelGrid({ reels, empty }: { reels: ReturnType<typeof resolveReelsMedia>; empty: string }) {
  const playable = reels.filter((reel) => reelThumbnailSrc(reel));

  if (!playable.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] text-fg-muted">{empty}</p>
        <Link href="/feed" className="mt-4 inline-block text-[14px] font-semibold text-[#0095f6]">
          Go to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-3 gap-[2px] lg:gap-1">
      {playable.map((reel) => (
        <Link key={reel.id} href={`/reels?reel=${encodeURIComponent(reel.id)}`}>
          <ReelThumbnail reel={reel} className="aspect-square w-full rounded-none" />
        </Link>
      ))}
    </div>
  );
}
