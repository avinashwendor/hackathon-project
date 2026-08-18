import { NextResponse } from "next/server";
import { z } from "zod";
import { getReel } from "@/data/reels";
import { rateLimit } from "@/lib/rate-limit";
import { DISLIKE_REASON_IDS } from "@/lib/social/dislike-reasons";
import { appendEvents, readSocial, updateSocial } from "@/lib/store";
import { requireApiAccount } from "@/lib/auth-api";
import type { Difficulty } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum([
    "follow",
    "unfollow",
    "dislike",
    "undislike",
    "unmute",
    "like",
    "unlike",
    "save",
    "unsave",
  ]),
  handle: z.string().max(60).optional(),
  reelId: z.string().max(80).optional(),
  topic: z.string().max(60).optional(),
  reason: z.string().max(40).optional(),
  detail: z.string().max(200).optional(),
});

function applyDislikeReason(
  reason: string | undefined,
  reelTopics: string[],
  currentMuted: string[],
): { mutedTopics: string[]; difficultyHint?: Difficulty; substanceBoost?: number } {
  const muted = new Set(currentMuted);

  switch (reason) {
    case "not_relevant":
    case "wrong_topic":
    case "already_know":
      for (const t of reelTopics) muted.add(t);
      break;
    case "too_basic":
      return { mutedTopics: [...muted], difficultyHint: "Intermediate" };
    case "too_advanced":
      return { mutedTopics: [...muted], difficultyHint: "Beginner" };
    case "too_much_hype":
      return { mutedTopics: [...muted], substanceBoost: 0.1 };
    default:
      for (const t of reelTopics) muted.add(t);
      break;
  }

  return { mutedTopics: [...muted] };
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, { key: "social", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const auth = await requireApiAccount();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { sessionId } = auth;
  const { action, handle, reelId, topic, reason, detail } = parsed.data;

  if (action === "dislike" && reason && !DISLIKE_REASON_IDS.has(reason as never)) {
    return NextResponse.json({ error: "Unknown dislike reason" }, { status: 400 });
  }

  const social = await updateSocial(sessionId, (current) => {
    switch (action) {
      case "follow":
        return handle
          ? { ...current, follows: [...new Set([...current.follows, handle])] }
          : current;
      case "unfollow":
        return { ...current, follows: current.follows.filter((h) => h !== handle) };
      case "dislike": {
        if (!reelId) return current;
        const reel = getReel(reelId);
        const topics = reel?.topics ?? [];
        const applied = applyDislikeReason(reason, topics, current.mutedTopics);
        const feedback = {
          ...(current.dislikeFeedback ?? {}),
          [reelId]: {
            reason: reason ?? "not_relevant",
            ...(detail?.trim() ? { detail: detail.trim() } : {}),
            at: new Date().toISOString(),
          },
        };
        return {
          ...current,
          dislikes: [...new Set([...current.dislikes, reelId])],
          mutedTopics: [...new Set(applied.mutedTopics)],
          dislikeFeedback: feedback,
          feedRank: undefined,
        };
      }
      case "undislike": {
        if (!reelId) return current;
        const reel = getReel(reelId);
        const nextFeedback = { ...(current.dislikeFeedback ?? {}) };
        delete nextFeedback[reelId];
        return {
          ...current,
          dislikes: current.dislikes.filter((id) => id !== reelId),
          dislikeFeedback: nextFeedback,
          mutedTopics: current.mutedTopics.filter((t) => {
            if (!reel?.topics.includes(t)) return true;
            return current.dislikes
              .filter((id) => id !== reelId)
              .some((id) => getReel(id)?.topics.includes(t));
          }),
        };
      }
      case "unmute":
        return { ...current, mutedTopics: current.mutedTopics.filter((t) => t !== topic) };
      case "like":
        return reelId
          ? { ...current, likes: [...new Set([...current.likes, reelId])] }
          : current;
      case "unlike":
        return reelId
          ? { ...current, likes: current.likes.filter((id) => id !== reelId) }
          : current;
      case "save":
        return reelId
          ? { ...current, saves: [...new Set([...current.saves, reelId])] }
          : current;
      case "unsave":
        return reelId
          ? { ...current, saves: current.saves.filter((id) => id !== reelId) }
          : current;
      default:
        return current;
    }
  });

  if (reelId && getReel(reelId)) {
    if (action === "dislike") {
      await appendEvents(sessionId, [
        {
          id: `${Date.now().toString(36)}-dislike`,
          sessionId,
          reelId,
          type: "not_interested",
          at: new Date().toISOString(),
          ...(reason ? { reason } : {}),
          ...(detail?.trim() ? { detail: detail.trim() } : {}),
        },
      ]);
    }
    if (action === "like") {
      await appendEvents(sessionId, [
        {
          id: `${Date.now().toString(36)}-like`,
          sessionId,
          reelId,
          type: "like",
          at: new Date().toISOString(),
        },
      ]);
    }
    if (action === "save") {
      await appendEvents(sessionId, [
        {
          id: `${Date.now().toString(36)}-save`,
          sessionId,
          reelId,
          type: "save",
          at: new Date().toISOString(),
        },
      ]);
    }
  }

  return NextResponse.json({ social });
}

export async function GET() {
  const auth = await requireApiAccount();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ social: await readSocial(auth.sessionId) });
}
