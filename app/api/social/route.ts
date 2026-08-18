import { NextResponse } from "next/server";
import { z } from "zod";
import { getReel } from "@/data/reels";
import { getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { appendEvents, readSocial, updateSocial } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["follow", "unfollow", "dislike", "undislike", "unmute"]),
  /** Creator handle for follow/unfollow. */
  handle: z.string().max(60).optional(),
  /** Reel id for dislike/undislike. */
  reelId: z.string().max(80).optional(),
  /** Topic id for unmute. */
  topic: z.string().max(60).optional(),
});

/**
 * Explicit social signals.
 *
 * A dislike is treated as much stronger than a skip: it also mutes the reel's
 * topics, so the suppression generalises instead of blocking one video and
 * cheerfully serving five more of the same thing.
 */
export async function POST(request: Request) {
  const limited = await rateLimit(request, { key: "social", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { sessionId } = await getViewer();
  const { action, handle, reelId, topic } = parsed.data;

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
        return {
          ...current,
          dislikes: [...new Set([...current.dislikes, reelId])],
          mutedTopics: [...new Set([...current.mutedTopics, ...(reel?.topics ?? [])])],
        };
      }
      case "undislike": {
        if (!reelId) return current;
        const reel = getReel(reelId);
        return {
          ...current,
          dislikes: current.dislikes.filter((id) => id !== reelId),
          // Only lift the mute if no other disliked reel still carries the topic.
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
      default:
        return current;
    }
  });

  // A dislike is also a behavioural event, so the taste vector sees it too.
  if (action === "dislike" && reelId && getReel(reelId)) {
    await appendEvents(sessionId, [
      {
        id: `${Date.now().toString(36)}-dislike`,
        sessionId,
        reelId,
        type: "not_interested",
        at: new Date().toISOString(),
      },
    ]);
  }

  return NextResponse.json({ social });
}

export async function GET() {
  const { sessionId } = await getViewer();
  return NextResponse.json({ social: await readSocial(sessionId) });
}
