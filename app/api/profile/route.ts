import { NextResponse } from "next/server";
import { TOPIC_BY_ID } from "@/data/ontology";
import { getReel } from "@/data/reels";
import { inferDeterministic } from "@/lib/agent/infer";
import { buildTasteProfile } from "@/lib/agent/taste";
import { getViewer } from "@/lib/auth";
import { readEvents } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything the system believes about this session, in one payload. The
 * profile page is a data-rights page as much as a dashboard: if something is
 * watching what you watch, you should be able to read what it wrote down.
 */
export async function GET() {
  const { sessionId } = await getViewer();
  const events = await readEvents(sessionId);
  const profile = await buildTasteProfile({ sessionId, events });

  const lastReelId = events[events.length - 1]?.reelId;
  const lastReel = lastReelId ? getReel(lastReelId) : undefined;

  return NextResponse.json({
    hasData: events.length > 0,
    eventCount: events.length,
    profile: {
      ...profile,
      // The raw vector is large and means nothing to a reader; the facets do.
      vector: undefined,
      vectorDims: profile.vector.length,
    },
    facets: profile.facets.slice(0, 12).map((facet) => ({
      ...facet,
      label: TOPIC_BY_ID.get(facet.topic)?.label ?? facet.topic,
      domain: TOPIC_BY_ID.get(facet.topic)?.domain ?? null,
    })),
    watched: profile.affinities
      .map((affinity) => {
        const reel = getReel(affinity.reelId);
        return reel ? { affinity, reel } : null;
      })
      .filter(Boolean),
    inference: lastReel ? inferDeterministic(lastReel, profile) : null,
  });
}
