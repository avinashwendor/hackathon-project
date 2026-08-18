import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { readEvents, readSocial } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who the viewer is, and how much the agent has on them. */
export async function GET() {
  const { sessionId, account } = await getViewer();
  const [events, social] = await Promise.all([readEvents(sessionId), readSocial(sessionId)]);

  return NextResponse.json({
    signedIn: Boolean(account),
    account: account ? { id: account.id, email: account.email, name: account.name } : null,
    eventCount: events.length,
    watchedCount: new Set(events.map((e) => e.reelId)).size,
    follows: social.follows,
    likes: social.likes.length,
    saves: social.saves.length,
    dislikes: social.dislikes.length,
    onboarded: Boolean(social.onboarding?.completedAt),
  });
}
