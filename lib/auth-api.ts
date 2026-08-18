import { NextResponse } from "next/server";
import { getViewer, type Viewer } from "@/lib/auth";

export type ApiAuthResult =
  | { ok: true; viewer: Viewer; sessionId: string }
  | { ok: false; response: NextResponse };

/** JSON 401 for API routes — pages use requireAccount() + redirect. */
export async function requireApiAccount(): Promise<ApiAuthResult> {
  const viewer = await getViewer();
  if (!viewer.account) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  return { ok: true, viewer, sessionId: viewer.sessionId };
}
