import { SCENARIO_BY_ID, scenarioToEvents } from "@/data/scenarios";
import { getReel } from "@/data/reels";
import { recommend } from "@/lib/agent/pipeline";
import { getViewer } from "@/lib/auth";
import { markRecommended, readEvents, readRecommended, readSocial } from "@/lib/store";
import type { AgentStage, InteractionEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The same pipeline as /api/agent/recommend, streamed. Inference and reranking
 * are two model round trips; without this the console shows ten seconds of
 * nothing, and the trace is the most interesting part of the product.
 */
export async function POST(request: Request) {
  const { sessionId } = await getViewer();
  const body = (await request.json().catch(() => ({}))) as {
    scenarioId?: string;
    currentReelId?: string;
    events?: InteractionEvent[];
    allowRepeat?: boolean;
  };

  let currentReelId = body.currentReelId;
  let events: InteractionEvent[];

  if (body.scenarioId) {
    const scenario = SCENARIO_BY_ID.get(body.scenarioId);
    if (!scenario) return new Response("Unknown scenario", { status: 404 });
    currentReelId = currentReelId ?? scenario.currentReelId;
    events = scenarioToEvents(scenario, sessionId, (id) => getReel(id)?.durationSec ?? 30);
  } else {
    events = body.events ?? (await readEvents(sessionId));
    currentReelId = currentReelId ?? events[events.length - 1]?.reelId;
  }

  if (!currentReelId || !getReel(currentReelId)) {
    return new Response("No current reel", { status: 400 });
  }

  const reelId = currentReelId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, payload })}\n\n`));
      };

      try {
        const [exclude, social] = await Promise.all([
          body.allowRepeat ? Promise.resolve([] as string[]) : readRecommended(sessionId),
          readSocial(sessionId),
        ]);
        const result = await recommend({
          sessionId,
          currentReelId: reelId,
          events,
          exclude,
          social,
          onStage: (stage: AgentStage) => send("stage", stage),
        });
        if (!body.scenarioId) await markRecommended(sessionId, result.recommendation.id);
        send("result", result);
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
