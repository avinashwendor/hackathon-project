import { NextResponse } from "next/server";
import { agentHealth } from "@/lib/agent/pipeline";
import { capabilities } from "@/lib/config";
import { storeStats } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [agent, store] = await Promise.all([agentHealth(), storeStats()]);
  return NextResponse.json({
    ok: true,
    service: "upstream",
    capabilities,
    agent,
    store,
    time: new Date().toISOString(),
  });
}
