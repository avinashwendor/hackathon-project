import { config } from "@/lib/config";
import type { InteractionEvent, ReelAffinity } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Implicit feedback.

   Students never rate anything, so every judgement here is inferred from
   behaviour. Two decisions carry most of the weight:

   1. A save outranks a like. A like is a reflex; a save is an intention to come
      back, and it is the single most honest positive signal in short-form.
   2. An early skip is a real negative, not a missing value. Treating "watched
      8% then swiped" as neutral is how feeds end up recommending things the
      user has already actively rejected.

   Everything decays. What held attention four hours ago should not outvote
   what held it four minutes ago.
--------------------------------------------------------------------------- */

export const SIGNAL_WEIGHTS = {
  completed: 0.6,
  mostlyWatched: 0.28,
  partiallyWatched: 0.05,
  earlySkip: -0.4,
  replay: 0.22,
  replayCap: 0.55,
  like: 0.35,
  save: 0.55,
  share: 0.45,
  notInterested: -1.0,
  expandCaption: 0.1,
  openProfile: 0.15,
} as const;

function decayFactor(at: string, now: number): number {
  const ageMinutes = Math.max(0, (now - new Date(at).getTime()) / 60_000);
  return Math.pow(0.5, ageMinutes / config.agent.halfLifeMinutes);
}

function describeCompletion(completion: number): string {
  if (completion >= 1.5) return `watched ${completion.toFixed(1)}× — re-watched twice or more`;
  if (completion >= 0.9) return `watched to the end (${Math.round(completion * 100)}%)`;
  if (completion >= 0.5) return `watched ${Math.round(completion * 100)}%`;
  if (completion >= 0.25) return `dropped at ${Math.round(completion * 100)}%`;
  return `skipped at ${Math.round(completion * 100)}%`;
}

/**
 * Roll an event stream into one signed affinity per reel, with the human-
 * readable basis the UI and the LLM prompt both quote as evidence.
 */
export function computeAffinities(events: InteractionEvent[], now = Date.now()): ReelAffinity[] {
  const byReel = new Map<string, InteractionEvent[]>();
  for (const event of events) {
    const list = byReel.get(event.reelId);
    if (list) list.push(event);
    else byReel.set(event.reelId, [event]);
  }

  const affinities: ReelAffinity[] = [];

  for (const [reelId, reelEvents] of byReel) {
    let raw = 0;
    const basis: string[] = [];
    let replayCredit = 0;
    let lastSeenAt = reelEvents[0].at;

    for (const event of reelEvents) {
      if (event.at > lastSeenAt) lastSeenAt = event.at;
      const decay = decayFactor(event.at, now);

      switch (event.type) {
        case "view": {
          const completion = event.completion ?? 0;
          let value: number;
          if (completion >= 0.9) value = SIGNAL_WEIGHTS.completed;
          else if (completion >= 0.5) value = SIGNAL_WEIGHTS.mostlyWatched;
          else if (completion >= 0.25) value = SIGNAL_WEIGHTS.partiallyWatched;
          else value = SIGNAL_WEIGHTS.earlySkip;
          // Re-watching past 100% keeps adding, with diminishing returns.
          if (completion > 1) value += Math.min(0.35, (completion - 1) * 0.3);
          raw += value * decay;
          basis.push(describeCompletion(completion));
          break;
        }
        case "replay": {
          const credit = Math.min(
            SIGNAL_WEIGHTS.replayCap - replayCredit,
            SIGNAL_WEIGHTS.replay * (event.replays ?? 1),
          );
          if (credit > 0) {
            replayCredit += credit;
            raw += credit * decay;
            basis.push(`replayed ${event.replays ?? 1}×`);
          }
          break;
        }
        case "like":
          raw += SIGNAL_WEIGHTS.like * decay;
          basis.push("liked");
          break;
        case "save":
          raw += SIGNAL_WEIGHTS.save * decay;
          basis.push("saved for later");
          break;
        case "share":
          raw += SIGNAL_WEIGHTS.share * decay;
          basis.push("shared");
          break;
        case "not_interested":
          raw += SIGNAL_WEIGHTS.notInterested * decay;
          basis.push("marked not interested");
          break;
        case "expand_caption":
          raw += SIGNAL_WEIGHTS.expandCaption * decay;
          basis.push("opened the caption");
          break;
        case "open_profile":
          raw += SIGNAL_WEIGHTS.openProfile * decay;
          basis.push("opened the creator");
          break;
        case "skip":
        case "complete":
          // Already accounted for by the view record; kept in the stream for the UI.
          break;
      }
    }

    affinities.push({
      reelId,
      score: Math.max(-1, Math.min(1, raw)),
      basis: [...new Set(basis)],
      lastSeenAt,
      events: reelEvents.length,
    });
  }

  return affinities.sort((a, b) => b.score - a.score);
}

/** The single strongest phrase for a reel, for compact evidence chips. */
export function primarySignal(affinity: ReelAffinity): string {
  const order = [
    "saved for later",
    "shared",
    "re-watched",
    "replayed",
    "watched to the end",
    "liked",
    "marked not interested",
    "skipped",
  ];
  for (const key of order) {
    const hit = affinity.basis.find((b) => b.includes(key.split(" ")[0]));
    if (hit) return hit;
  }
  return affinity.basis[0] ?? "seen";
}
