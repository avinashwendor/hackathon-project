import { NextResponse } from "next/server";
import { agentHealth } from "@/lib/agent/pipeline";
import { dbPing } from "@/lib/db/client";
import { capabilities, config } from "@/lib/config";
import { storeDriver, storeStats } from "@/lib/store";
import { indexInfo } from "@/lib/vector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [agent, store, vector, postgresOk] = await Promise.all([
    agentHealth(),
    storeStats(),
    indexInfo().catch(() => null),
    config.database.url ? dbPing() : Promise.resolve(false),
  ]);

  return NextResponse.json({
    ok: true,
    service: "upstream",
    capabilities,
    storage: {
      sessionStore: storeDriver(),
      postgresOk: config.database.url ? postgresOk : undefined,
      vectorStore: vector?.store ?? "not-indexed",
      embeddingProvider: vector?.provider ?? null,
      vectorCount: vector?.count ?? 0,
      embeddingsCached: vector?.cached ?? false,
      vectorFallback: vector?.fallbackReason ?? null,
    },
    agent,
    store,
    time: new Date().toISOString(),
  });
}
