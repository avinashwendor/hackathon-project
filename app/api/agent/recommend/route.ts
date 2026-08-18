import { NextResponse } from "next/server";
import { SCENARIO_BY_ID, scenarioToEvents } from "@/data/scenarios";
import { getReel } from "@/data/reels";
import { recommend } from "@/lib/agent/pipeline";
import { agentRequestSchema } from "@/lib/api/schemas";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getViewer } from "@/lib/auth";
import { requireApiAccount } from "@/lib/auth-api";
import { errorMessage } from "@/lib/errors";
import { markRecommended, readEvents, readRecommended, readSocial } from "@/lib/store";
import type { InteractionEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, agentRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { scenarioId, allowRepeat } = parsed.data;

  if (!scenarioId) {
    const auth = await requireApiAccount();
    if (!auth.ok) return auth.response;
  }

  const { sessionId } = await getViewer();
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
      { error: errorMessage(err) || "The agent could not produce a recommendation." },
      { status: 500 },
    );
  }
}
