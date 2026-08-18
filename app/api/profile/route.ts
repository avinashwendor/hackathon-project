import { NextResponse } from "next/server";
import { TOPIC_BY_ID } from "@/data/ontology";
import { getReel } from "@/data/reels";
import { inferDeterministic } from "@/lib/agent/infer";
import { buildTasteProfile } from "@/lib/agent/taste";
import { requireApiAccount } from "@/lib/auth-api";
import { readEvents } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything the system believes about this session, in one payload. The
 * profile page is a data-rights page as much as a dashboard: if something is
 * watching what you watch, you should be able to read what it wrote down.
 */
export async function GET() {
  try {
    const auth = await requireApiAccount();
    if (!auth.ok) return auth.response;
    const { sessionId } = auth;
    const events = await readEvents(sessionId);
    const profile = await buildTasteProfile({ sessionId, events });

    const lastReelId = events[events.length - 1]?.reelId;
    const lastReel = lastReelId ? getReel(lastReelId) : undefined;

    return NextResponse.json({
      hasData: events.length > 0,
      eventCount: events.length,
      profile: {
        ...profile,
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
  } catch (err) {
    console.error("[profile] GET failed:", err);
    return NextResponse.json(
      { error: "Could not load profile data." },
      { status: 500 },
    );
  }
}
