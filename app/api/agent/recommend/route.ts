import { NextResponse } from "next/server";
import { z } from "zod";
import { SCENARIO_BY_ID, scenarioToEvents } from "@/data/scenarios";
import { getReel } from "@/data/reels";
import { recommend } from "@/lib/agent/pipeline";
import { getViewer } from "@/lib/auth";
import { markRecommended, readEvents, readRecommended, readSocial } from "@/lib/store";
import type { InteractionEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Load a canned demo history instead of the live session. */
  scenarioId: z.string().optional(),
  currentReelId: z.string().optional(),
  /** Client-side event mirror, used by the feed so a recommendation is never stale. */
  events: z.array(z.record(z.string(), z.unknown())).optional(),
  allowRepeat: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { sessionId } = await getViewer();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { scenarioId, allowRepeat } = parsed.data;
  let currentReelId = parsed.data.currentReelId;
  let events: InteractionEvent[];

  if (scenarioId) {
    const scenario = SCENARIO_BY_ID.get(scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: `Unknown scenario: ${scenarioId}` }, { status: 404 });
    }
    currentReelId = currentReelId ?? scenario.currentReelId;
    events = scenarioToEvents(scenario, sessionId, (id) => getReel(id)?.durationSec ?? 30);
  } else {
    events = (parsed.data.events as InteractionEvent[] | undefined) ?? (await readEvents(sessionId));
    currentReelId = currentReelId ?? events[events.length - 1]?.reelId;
  }

  if (!currentReelId || !getReel(currentReelId)) {
    return NextResponse.json(
      { error: "No current reel. Pass currentReelId or scenarioId." },
      { status: 400 },
    );
  }

  try {
    const [exclude, social] = await Promise.all([
      allowRepeat ? Promise.resolve([] as string[]) : readRecommended(sessionId),
      readSocial(sessionId),
    ]);
    const result = await recommend({ sessionId, currentReelId, events, exclude, social });
    if (!scenarioId) await markRecommended(sessionId, result.recommendation.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[agent] recommend failed:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "The agent could not produce a recommendation." },
      { status: 500 },
    );
  }
}
