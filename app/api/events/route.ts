import { NextResponse } from "next/server";
import { z } from "zod";
import { getReel } from "@/data/reels";
import { buildTasteProfile } from "@/lib/agent/taste";
import { getViewer } from "@/lib/auth";
import { appendEvents, clearSession, readEvents } from "@/lib/store";
import { EVENT_TYPES, type InteractionEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  reelId: z.string(),
  type: z.enum(EVENT_TYPES),
  at: z.string().optional(),
  watchedMs: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  completion: z.number().nonnegative().optional(),
  replays: z.number().nonnegative().optional(),
});

const bodySchema = z.object({ events: z.array(eventSchema).max(60) });

/** Append interaction events and return the profile they produce. */
export async function POST(request: Request) {
  const { sessionId } = await getViewer();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid events payload" }, { status: 400 });
  }

  const events: InteractionEvent[] = parsed.data.events
    .filter((event) => getReel(event.reelId))
    .map((event, i) => ({
      ...event,
      id: `${Date.now().toString(36)}-${i}`,
      sessionId,
      at: event.at ?? new Date().toISOString(),
    }));

  const total = await appendEvents(sessionId, events);
  const profile = await buildTasteProfile({ sessionId, events: await readEvents(sessionId) });

  return NextResponse.json({
    accepted: events.length,
    total,
    profile: {
      facets: profile.facets.slice(0, 8),
      categories: profile.categories,
      signalStrength: profile.signalStrength,
      difficultyBias: profile.difficultyBias,
      affinities: profile.affinities.slice(0, 10),
    },
  });
}

export async function GET() {
  const { sessionId } = await getViewer();
  return NextResponse.json({ events: await readEvents(sessionId) });
}

export async function DELETE() {
  const { sessionId } = await getViewer();
  await clearSession(sessionId);
  return NextResponse.json({ cleared: true });
}
