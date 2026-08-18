import { NextResponse } from "next/server";
import { SCENARIO_BY_ID, scenarioToEvents } from "@/data/scenarios";
import { getReel } from "@/data/reels";
import { recommendShallow } from "@/lib/agent/baseline";
import { recommend } from "@/lib/agent/pipeline";
import { compareRequestSchema } from "@/lib/api/schemas";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getViewer } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs both recommenders over the same history so the difference is measured
 * rather than asserted. This is the page the brief's built-in trap is about.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, compareRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { sessionId } = await getViewer();
  const { scenarioId } = parsed.data;

  const scenario = SCENARIO_BY_ID.get(scenarioId ?? "the-trap");
  if (!scenario) {
    return NextResponse.json({ error: `Unknown scenario: ${scenarioId}` }, { status: 404 });
  }

  const currentReel = getReel(scenario.currentReelId);
  if (!currentReel) {
    return NextResponse.json({ error: "Scenario references an unknown reel" }, { status: 500 });
  }

  const events = scenarioToEvents(scenario, sessionId, (id) => getReel(id)?.durationSec ?? 30);

  try {
    const [agent, shallow] = await Promise.all([
      recommend({ sessionId, currentReelId: scenario.currentReelId, events }),
      Promise.resolve(recommendShallow(currentReel, events)),
    ]);

    return NextResponse.json({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        tagline: scenario.tagline,
        premise: scenario.premise,
        shallowTrap: scenario.shallowTrap,
      },
      currentReel,
      agent,
      shallow,
    });
  } catch (err) {
    console.error("[agent] compare failed:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
