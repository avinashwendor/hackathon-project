"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Play, Sparkles } from "lucide-react";
import type { AgentResult, InteractionEvent, Reel } from "@/lib/types";
import { resolveReelsMedia } from "@/data/reels";
import { AgentCard } from "@/components/agent/agent-card";
import { Diagnostics, InferencePanel, RejectedList, StageList } from "@/components/agent/trace";
import { useAgentRun } from "@/components/agent/use-agent-run";
import { reelThumbnailSrc, ReelThumbnail } from "@/components/catalog/reel-thumbnail";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { PostShimmer } from "@/components/feed/feed-shimmer";

interface ProfilePayload {
  hasData: boolean;
  eventCount: number;
  inference: {
    primaryInterest: string;
    underlyingMotivation: string;
    confidence: string;
  } | null;
  facets: { label: string; weight: number }[];
}

export function ForYouExperience() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [events, setEvents] = useState<InteractionEvent[]>([]);
  const [feedPreview, setFeedPreview] = useState<Reel[]>([]);
  const { status, stages, result, error, run, reset } = useAgentRun();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, eventsRes, feedRes] = await Promise.all([
        fetch("/api/profile", { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
        fetch("/api/feed?limit=3", { cache: "no-store" }),
      ]);

      if (profileRes.ok) {
        setProfile((await profileRes.json()) as ProfilePayload);
      }
      if (eventsRes.ok) {
        const json = (await eventsRes.json()) as { events: InteractionEvent[] };
        setEvents(json.events ?? []);
      }
      if (feedRes.ok) {
        const json = (await feedRes.json()) as { reels: Reel[] };
        setFeedPreview(resolveReelsMedia(json.reels ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recommend = () => {
    const last = events[events.length - 1];
    const currentReelId = last?.reelId ?? feedPreview[0]?.id;
    if (!currentReelId) return;
    void run({ currentReelId, events, allowRepeat: false });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-8">
        <PostShimmer />
        <PostShimmer />
      </div>
    );
  }

  const hasHistory = (profile?.eventCount ?? 0) > 0 || events.length > 0;
  const recommended = result?.recommendation
    ? resolveReelsMedia([result.recommendation])[0]
    : null;
  const playableFeed = feedPreview.filter((reel) => reelThumbnailSrc(reel));

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 pb-24 lg:pb-8">
      <div className="mb-8">
        <Badge tone="primary">For you</Badge>
        <h1 className="mt-3 text-[24px] font-semibold">Your next reel</h1>
        <p className="mt-2 text-[14px] leading-6 text-fg-muted">
          Based on what you liked, saved, and watched — not keywords. The agent reads your
          behaviour and picks one reel worth your next minute.
        </p>
      </div>

      {!hasHistory ? (
        <Card className="gap-4 p-6">
          <Sparkles className="size-8 text-[#0095f6]" />
          <h2 className="text-[18px] font-semibold">Watch a few reels first</h2>
          <p className="text-[14px] text-fg-muted">
            Scroll your feed or reels, like what resonates, pass on what doesn&apos;t. Then come
            back here for a personalized pick.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/reels">
              <Button>Open reels</Button>
            </Link>
            <Link href="/feed">
              <Button variant="ghost">Browse feed</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {profile?.inference && (
            <Card className="mb-6 gap-3 border-[#0095f6]/20 bg-[#0095f6]/5 p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#0095f6]">
                What we think you&apos;re learning
              </p>
              <p className="text-[18px] font-semibold">{profile.inference.primaryInterest}</p>
              <p className="text-[14px] text-fg-muted">{profile.inference.underlyingMotivation}</p>
              {profile.facets.slice(0, 3).map((f) => (
                <span key={f.label} className="mr-2 inline-block text-[13px] text-fg-subtle">
                  {f.label} · {(f.weight * 100).toFixed(0)}%
                </span>
              ))}
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={recommend} disabled={status === "running"}>
              {status === "running" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Finding your next reel…
                </>
              ) : (
                "Recommend my next reel"
              )}
            </Button>
            {result && (
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            )}
          </div>

          {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

          {status === "running" && stages.length > 0 && (
            <Card className="mt-6 p-5">
              <StageList stages={stages} />
            </Card>
          )}

          {result && (
            <div className="mt-8 space-y-6">
              <AgentCard result={result} />

              {recommended && reelThumbnailSrc(recommended) && (
                <Link
                  href={`/reels?reel=${encodeURIComponent(recommended.id)}`}
                  className="block overflow-hidden rounded-lg border border-line"
                >
                  <ReelThumbnail reel={recommended} className="aspect-[4/5] w-full rounded-none" />
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{recommended.title}</p>
                      <p className="text-[13px] text-fg-muted">{recommended.category}</p>
                    </div>
                    <span className="flex items-center gap-1 text-[13px] font-semibold text-[#0095f6]">
                      <Play className="size-4" /> Watch
                    </span>
                  </div>
                </Link>
              )}

              {result.inference && <InferencePanel inference={result.inference} />}
              {result.rejected.length > 0 && <RejectedList rejected={result.rejected} />}
              {result.diagnostics && <Diagnostics diagnostics={result.diagnostics} />}
            </div>
          )}
        </>
      )}

      {playableFeed.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[15px] font-semibold">Fresh from your feed</h2>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {playableFeed.map((reel) => (
              <Link key={reel.id} href={`/reels?reel=${encodeURIComponent(reel.id)}`}>
                <ReelThumbnail reel={reel} className="aspect-square w-full rounded-none" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
