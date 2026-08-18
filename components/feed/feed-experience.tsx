"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Compass, Heart, Loader2, Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import type {
  AgentResult,
  EventType,
  InteractionEvent,
  Reel,
  TasteFacet,
} from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/utils";
import { useAgentRun } from "@/components/agent/use-agent-run";
import { InteractionBar, type ReelInteractionState, type SocialAction } from "./interaction-bar";
import { ReelPlayer } from "./reel-player";

/* ---------------------------------------------------------------------------
   The feed.

   A vertical snap scroller, instrumented. Every slide measures how long it was
   actually on screen and reports a completion ratio, which is the signal the
   whole agent rests on — so the tracking lives here rather than in a hook that
   guesses from scroll position.

   The rail on the right is the point of the product: the interest the agent
   currently believes, updating as you scroll, with the evidence visible. When
   you ask for a redirect, the recommended reel is spliced in directly after the
   one you are on, so the feed itself gets better rather than sending you away.
--------------------------------------------------------------------------- */

/** Pure loader: state is only touched by the caller, after the await resolves. */
async function fetchSocial(): Promise<{ follows: string[]; dislikes: string[] } | null> {
  try {
    const res = await fetch("/api/social", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { social: { follows: string[]; dislikes: string[] } };
    return json.social;
  } catch {
    return null;
  }
}

const EMPTY_STATE: ReelInteractionState = {
  liked: false,
  saved: false,
  shared: false,
  dismissed: false,
};

interface ProfileSnapshot {
  facets: TasteFacet[];
  signalStrength: number;
  difficultyBias: number;
}

export function FeedExperience({ initialReels }: { initialReels: Reel[] }) {
  const [reels, setReels] = useState(initialReels);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [states, setStates] = useState<Record<string, ReelInteractionState>>({});
  const [showCard, setShowCard] = useState(false);
  const [follows, setFollows] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(false);
  const tapRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  // Local mirror of everything sent, so a recommendation always reflects the
  // very last swipe even if the POST is still in flight.
  const eventsRef = useRef<InteractionEvent[]>([]);
  const watchRef = useRef<{ reelId: string; start: number; accumulated: number } | null>(null);

  const { status, result, run, reset } = useAgentRun();
  const activeReel = reels[activeIndex];

  // Restore the social graph so follows and dislikes survive a reload.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const social = await fetchSocial();
      if (cancelled || !social) return;
      setFollows(social.follows);
      setStates((prev) => {
        const next = { ...prev };
        for (const id of social.dislikes) {
          next[id] = { ...(next[id] ?? EMPTY_STATE), dismissed: true };
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Event plumbing --------------------------------------------------- */

  const send = useCallback(
    async (events: Omit<InteractionEvent, "id" | "sessionId">[]) => {
    if (!events.length) return;
    const stamped = events.map((event, i) => ({
      ...event,
      id: `local-${Date.now().toString(36)}-${i}`,
      sessionId: "local",
      at: event.at ?? new Date().toISOString(),
    })) as InteractionEvent[];

    eventsRef.current = [...eventsRef.current, ...stamped].slice(-200);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      if (res.ok) {
        const json = (await res.json()) as { profile: ProfileSnapshot };
        void json.profile;
      }
    } catch {
      // Offline is survivable: the local mirror still drives the agent.
    }
    },
    [],
  );

  /** Close out the reel we are leaving, with the time it actually held. */
  const flushWatch = useCallback(() => {
    const watch = watchRef.current;
    if (!watch) return;
    const reel = reels.find((r) => r.id === watch.reelId);
    if (!reel) return;

    const watchedMs = watch.accumulated + (Date.now() - watch.start);
    if (watchedMs < 400) return;

    const durationMs = reel.durationSec * 1000;
    const completion = watchedMs / durationMs;

    void send([
      { reelId: reel.id, type: "view", watchedMs, durationMs, completion, at: new Date().toISOString() },
      ...(completion >= 0.9
        ? [{ reelId: reel.id, type: "complete" as EventType, completion, durationMs, at: new Date().toISOString() }]
        : []),
      ...(completion < 0.25
        ? [{ reelId: reel.id, type: "skip" as EventType, completion, at: new Date().toISOString() }]
        : []),
    ]);
  }, [reels, send]);

  useEffect(() => {
    if (!activeReel) return;
    flushWatch();
    watchRef.current = { reelId: activeReel.id, start: Date.now(), accumulated: 0 };
    return () => {
      const watch = watchRef.current;
      if (watch && watch.reelId === activeReel.id) {
        watch.accumulated += Date.now() - watch.start;
        watch.start = Date.now();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReel?.id]);

  // Flush on tab hide and unload, or a long final watch is simply lost.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushWatch();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushWatch);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushWatch);
    };
  }, [flushWatch]);

  /* --- Which slide is active ------------------------------------------- */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) {
              setActiveIndex(index);
              setPaused(false);
            }
          }
        }
      },
      { root: container, threshold: [0.6] },
    );

    for (const slide of slideRefs.current) if (slide) observer.observe(slide);
    return () => observer.disconnect();
  }, [reels.length]);

  /* --- Actions ---------------------------------------------------------- */

  const act = useCallback(
    (reelId: string, type: EventType) => {
      let becameDisliked = false;
      let wasDisliked = false;

      setStates((prev) => {
        const current = prev[reelId] ?? EMPTY_STATE;
        const next = { ...current };
        if (type === "like") next.liked = !current.liked;
        if (type === "save") next.saved = !current.saved;
        if (type === "share") next.shared = true;
        if (type === "not_interested") {
          next.dismissed = !current.dismissed;
          becameDisliked = next.dismissed;
          wasDisliked = current.dismissed;
        }
        return { ...prev, [reelId]: next };
      });

      if (type === "not_interested") {
        // A dislike is an explicit instruction, not a weak signal — it also
        // mutes the reel's topics server-side so the suppression generalises.
        void fetch("/api/social", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: wasDisliked ? "undislike" : "dislike", reelId }),
        }).catch(() => {});
        if (becameDisliked) return;
      }

      void send([{ reelId, type, at: new Date().toISOString() }]);
    },
    [send],
  );

  const toggleFollow = useCallback((handle: string, action: SocialAction) => {
    setFollows((prev) =>
      action === "follow" ? [...new Set([...prev, handle])] : prev.filter((h) => h !== handle),
    );
    void fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, handle }),
    }).catch(() => {});
  }, []);

  const askAgent = useCallback(() => {
    if (!activeReel) return;
    setShowCard(true);
    void run({
      currentReelId: activeReel.id,
      events: eventsRef.current,
      allowRepeat: false,
    });
  }, [activeReel, run]);

  /** Splice the recommendation in as the very next reel. */
  const acceptRecommendation = useCallback(
    (reel: AgentResult["recommendation"]) => {
      setReels((prev) => {
        if (prev.some((r) => r.id === reel.id)) return prev;
        const next = [...prev];
        next.splice(activeIndex + 1, 0, reel);
        return next;
      });
      setShowCard(false);
      reset();
      requestAnimationFrame(() => {
        slideRefs.current[activeIndex + 1]?.scrollIntoView({ behavior: "smooth" });
      });
    },
    [activeIndex, reset],
  );

  const likeActive = () => {
    if (!activeReel) return;
    const already = states[activeReel.id]?.liked;
    if (!already) act(activeReel.id, "like");
    setBurst(true);
    window.setTimeout(() => setBurst(false), 850);
  };

  const onSlideTap = () => {
    if (tapRef.current) {
      window.clearTimeout(tapRef.current);
      tapRef.current = null;
      likeActive();
      return;
    }
    tapRef.current = window.setTimeout(() => {
      tapRef.current = null;
      setPaused((p) => !p);
    }, 250);
  };

  return (
    <div className="relative flex h-[calc(100dvh-52px)] justify-center bg-black lg:h-dvh">
      <div
        ref={containerRef}
        className="no-scrollbar h-full w-full max-w-[470px] snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {reels.map((reel, index) => {
          const state = states[reel.id] ?? EMPTY_STATE;
          const active = index === activeIndex;
          return (
            <article
              key={`${reel.id}-${index}`}
              data-index={index}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className="relative h-full snap-start snap-always overflow-hidden"
            >
              <ReelPlayer
                reel={reel}
                active={active}
                muted={muted}
                paused={paused && active}
                className="absolute inset-0"
              />

              <button
                type="button"
                className="absolute inset-0 z-10"
                aria-label="Pause or like"
                onClick={onSlideTap}
              />

              {active && burst && (
                <Heart
                  className="animate-ig-heart pointer-events-none absolute top-1/2 left-1/2 z-20 size-24 -translate-x-1/2 -translate-y-1/2 text-white"
                  fill="white"
                  strokeWidth={0}
                />
              )}

              {active && paused && (
                <Play
                  className="pointer-events-none absolute top-1/2 left-1/2 z-20 size-16 -translate-x-1/2 -translate-y-1/2 fill-white text-white opacity-80"
                  strokeWidth={0}
                />
              )}

              <div className="pointer-events-none absolute top-4 right-4 left-4 z-20 flex items-center justify-between lg:hidden">
                <span className="text-[20px] font-semibold text-white">Reels</span>
                <Link href="/studio" className="pointer-events-auto text-white" aria-label="Create">
                  <Camera className="size-6" strokeWidth={1.8} />
                </Link>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 bg-linear-to-t from-black/70 via-black/20 to-transparent p-4 pb-6">
                <div className="min-w-0 flex-1">
                  <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-white">
                      {reel.creator.handle}
                    </span>
                    {reel.creator.verified && (
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-[#0095f6] text-[9px] font-bold text-white">
                        ✓
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        toggleFollow(
                          reel.creator.handle,
                          follows.includes(reel.creator.handle) ? "unfollow" : "follow",
                        )
                      }
                      className="rounded-md border border-white/80 px-2 py-0.5 text-[12px] font-semibold text-white"
                    >
                      {follows.includes(reel.creator.handle) ? "Following" : "Follow"}
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-white/90">
                    {reel.caption}
                  </p>
                  <p className="mt-2 text-[12px] text-white/55">
                    {formatCount(reel.stats.plays)} plays · {reel.category}
                  </p>
                </div>

                <div className="pointer-events-auto">
                  <InteractionBar
                    reel={reel}
                    state={state}
                    following={follows.includes(reel.creator.handle)}
                    onAction={(type) => act(reel.id, type)}
                    onFollow={(action) => toggleFollow(reel.creator.handle, action)}
                    className="shrink-0 pb-1"
                  />
                </div>
              </div>
            </article>
          );
        })}

        <div className="flex h-full snap-start flex-col items-center justify-center gap-5 p-8 text-center">
          <Compass className="size-9 text-white/70" strokeWidth={1.6} aria-hidden />
          <p className="max-w-[24ch] text-[22px] font-semibold text-white">You&apos;re all caught up</p>
          <p className="max-w-[32ch] text-[14px] text-white/60">
            Ask the agent where to go next — it reads what you just watched and splices the answer
            in right here.
          </p>
          <Button onClick={askAgent} size="lg">
            Where should I go next?
          </Button>
        </div>
      </div>

      {showCard && (
        <div className="fixed inset-x-0 bottom-[52px] z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-white/12 bg-black/95 p-4 backdrop-blur-xl lg:bottom-0 lg:left-auto lg:max-w-[400px]">
          <RecommendationPanel
            result={result}
            onAccept={acceptRecommendation}
            onDismiss={() => {
              setShowCard(false);
              reset();
            }}
          />
        </div>
      )}

      {!showCard && (
        <button
          type="button"
          onClick={askAgent}
          className="focus-ring fixed top-4 right-4 z-30 hidden items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[13px] font-medium text-white backdrop-blur-md lg:flex"
        >
          {status === "running" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          For you
        </button>
      )}

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="focus-ring absolute top-4 right-4 z-30 rounded-full bg-black/40 p-2 text-white lg:right-20"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  );
}

function RecommendationPanel({
  result,
  onAccept,
  onDismiss,
}: {
  result: AgentResult | null;
  onAccept: (reel: Reel) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-primary-400/25 bg-primary-500/[0.07] p-5">
      {!result ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-body text-fg-muted">
            <Loader2 className="size-4 animate-spin text-primary-400" aria-hidden />
            Reading behaviour, climbing from the surface topic, refusing the hype…
          </p>
          {[88, 66, 74].map((w, i) => (
            <div key={i} className="h-2.5 overflow-hidden rounded-full bg-white/8" style={{ width: `${w}%` }}>
              <div className="animate-sweep h-full w-1/3 bg-linear-to-r from-transparent via-white/25 to-transparent" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-eyebrow text-primary-400">Interest detected</p>
          <p className="mt-2 font-display text-[22px] leading-tight font-bold text-fg">
            {result.card.interestDetected}
          </p>
          <p className="mt-3 text-body text-fg-muted">{result.card.why}</p>

          <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ink">{result.card.category}</Badge>
              <Badge tone="ink">{result.card.difficulty}</Badge>
              <Badge tone="ink">confidence {result.card.confidence}</Badge>
            </div>
            <p className="mt-3 text-[15px] leading-6 font-medium text-fg">
              {result.card.recommendedTechReel}
            </p>
            <p className="mt-2 text-body text-fg-muted">{result.card.whyThisRecommendation}</p>
          </div>

          {result.rejected.filter((r) => r.reason === "hype").length > 0 && (
            <p className="mt-4 text-small text-warn">
              Blocked {result.rejected.filter((r) => r.reason === "hype").length} hype candidate(s)
              before ranking.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="md" onClick={() => onAccept(result.recommendation)}>
              Play it next
            </Button>
            <Button size="md" variant="ghost" onClick={onDismiss}>
              Not now
            </Button>
            <Link
              href="/agent"
              className="focus-ring inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              See the full trace
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
