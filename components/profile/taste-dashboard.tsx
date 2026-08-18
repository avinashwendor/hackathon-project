"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import type { Category, InterestInference, Reel, ReelAffinity, TasteProfile } from "@/lib/types";
import { ReelThumbnail } from "@/components/catalog/reel-thumbnail";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, Card, Chip, Meter } from "@/components/ui/primitives";
import { cn, relativeTime } from "@/lib/utils";

interface ProfileResponse {
  hasData: boolean;
  eventCount: number;
  profile: Omit<TasteProfile, "vector"> & { vectorDims: number };
  facets: { topic: string; label: string; domain: string | null; weight: number; evidenceReelIds: string[] }[];
  watched: { affinity: ReelAffinity; reel: Reel }[];
  inference: InterestInference | null;
}

export function TasteDashboard() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      setData((await res.json()) as ProfileResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const forget = async () => {
    setClearing(true);
    setLoading(true);
    await fetch("/api/events", { method: "DELETE" });
    await load();
    setClearing(false);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-10 text-body text-fg-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Reading your session…
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <Card className="items-start gap-4 p-10">
        <h2 className="text-heading-2 text-fg">Nothing recorded yet</h2>
        <p className="max-w-[52ch] text-body-lg text-fg-muted">
          Like, save, or watch reels — the agent builds your taste profile from those signals.
          Your onboarding preferences already shape your feed.
        </p>
        <Link href="/feed" className={buttonClasses({ className: "mt-2" })}>
          Go to your feed
        </Link>
      </Card>
    );
  }

  const { profile, facets, watched, inference } = data;
  const categories = (Object.entries(profile.categories) as [Category, number][])
    .filter(([, w]) => Math.abs(w) > 0.01)
    .sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(...categories.map(([, w]) => Math.abs(w)), 1);
  const maxFacet = Math.max(...facets.map((f) => f.weight), 1);

  return (
    <div className="space-y-10">
      {/* Headline */}
      {inference && (
        <Card className="gap-5 border-primary-200 bg-primary-100/30 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="primary">Current read</Badge>
            <span className="text-mono-xs text-fg-subtle">
              updated {relativeTime(profile.updatedAt)}
            </span>
          </div>
          <h2 className="font-display text-[30px] leading-tight font-bold text-balance text-fg sm:text-[36px]">
            {inference.primaryInterest}
          </h2>
          <p className="max-w-[70ch] text-body-lg text-fg-muted">{inference.underlyingMotivation}</p>
          <div className="flex flex-wrap gap-2">
            {inference.breadthDetected && <Chip tone="primary">breadth detected</Chip>}
            {inference.careerSignal && <Chip tone="signal">{inference.careerSignal}</Chip>}
            <Chip tone="neutral">confidence {inference.confidence}</Chip>
          </div>
        </Card>
      )}

      {/* Numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-3">
          <p className="text-eyebrow text-fg-subtle">Signal strength</p>
          <p className="font-display text-[34px] leading-none font-bold text-fg">
            {Math.round(profile.signalStrength * 100)}%
          </p>
          <Meter value={profile.signalStrength} />
          <p className="text-small text-fg-muted">
            How much evidence the read rests on. Low strength caps confidence, by design.
          </p>
        </Card>

        <Card className="gap-3">
          <p className="text-eyebrow text-fg-subtle">Level lean</p>
          <p className="font-display text-[34px] leading-none font-bold text-fg">
            {profile.difficultyBias < 0.34
              ? "Beginner"
              : profile.difficultyBias < 0.67
                ? "Intermediate"
                : "Advanced"}
          </p>
          <Meter value={profile.difficultyBias} tone="signal" />
          <p className="text-small text-fg-muted">
            Read from what holds your attention, not from what you clicked.
          </p>
        </Card>

        <Card className="gap-3">
          <p className="text-eyebrow text-fg-subtle">Session</p>
          <p className="font-display text-[34px] leading-none font-bold text-fg">
            {data.eventCount}
          </p>
          <p className="text-small text-fg-muted">
            signals across {watched.length} reels · {profile.vectorDims}-dimensional taste vector
          </p>
        </Card>
      </div>

      {/* Facets */}
      <section>
        <h2 className="text-eyebrow text-fg-subtle">Inferred topics</h2>
        <ul className="mt-5 space-y-3">
          {facets.map((facet) => (
            <li key={facet.topic}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[15px] font-medium text-fg">{facet.label}</p>
                <p className="text-mono-xs text-fg-subtle">
                  {facet.domain} · {facet.weight.toFixed(2)}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary-500 transition-[width] duration-700"
                  style={{ width: `${(facet.weight / maxFacet) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-eyebrow text-fg-subtle">Category pull</h2>
        <p className="mt-2 text-body text-fg-muted">
          Negative bars are categories you actively pushed away — skips are evidence too.
        </p>
        <ul className="mt-5 space-y-2.5">
          {categories.map(([category, weight]) => (
            <li key={category} className="flex items-center gap-4">
              <span className="w-28 shrink-0 text-[14px] text-fg">{category}</span>
              <div className="relative h-6 flex-1">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
                <span
                  className={cn(
                    "absolute inset-y-1 rounded-sm",
                    weight >= 0 ? "left-1/2 bg-primary-400" : "right-1/2 bg-danger/60",
                  )}
                  style={{ width: `${(Math.abs(weight) / maxCategory) * 50}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-mono-xs text-fg-subtle tabular-nums">
                {weight >= 0 ? "+" : ""}
                {weight.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Watch log */}
      <section>
        <h2 className="text-eyebrow text-fg-subtle">What it saw you do</h2>
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {watched.map(({ affinity, reel }) => (
            <li key={affinity.reelId} className="flex items-center gap-4 p-4">
              <ReelThumbnail reel={reel} className="h-14 w-10 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-fg">{reel.title}</p>
                <p className="mt-0.5 text-small text-fg-muted">{affinity.basis.join(" · ")}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-xs px-2 py-1 text-mono-xs tabular-nums",
                  affinity.score >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                )}
              >
                {affinity.score >= 0 ? "+" : ""}
                {affinity.score.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Controls */}
      <Card className="flex-row flex-wrap items-center justify-between gap-4 bg-surface-2/40">
        <div>
          <h2 className="text-heading-3 font-semibold text-fg">Forget everything</h2>
          <p className="mt-1 max-w-[54ch] text-body text-fg-muted">
            Wipes the session: every event, the taste vector and the inferred interests. No copy is
            kept anywhere else.
          </p>
        </div>
        <Button variant="tertiary" onClick={forget} disabled={clearing} leadingIcon={<Trash2 className="size-4" />}>
          {clearing ? "Clearing…" : "Clear my data"}
        </Button>
      </Card>
    </div>
  );
}
