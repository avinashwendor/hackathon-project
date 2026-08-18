import { NextResponse } from "next/server";
import { z } from "zod";
import { registerRuntimeReel } from "@/data/reels";
import { detectHype } from "@/lib/agent/hype";
import { publicUrlFor, storageDriver } from "@/lib/storage";
import { addReel } from "@/lib/store";
import { indexReel } from "@/lib/vector";
import { requireApiAccount } from "@/lib/auth-api";
import { CATEGORIES, DIFFICULTIES, type Reel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(3).max(140),
  caption: z.string().max(400).default(""),
  transcript: z.string().min(20).max(6000),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  topics: z.array(z.string()).max(6).default([]),
  outcome: z.string().max(300).default(""),
  prerequisites: z.array(z.string()).max(5).default([]),
  durationSec: z.number().min(3).max(600).default(45),
  creatorHandle: z.string().max(40).default("@you"),
  creatorName: z.string().max(60).default("You"),
  /** Object key from the presign step, if a file was uploaded. */
  storageKey: z.string().optional(),
  /** A master.m3u8 produced by the transcoder. */
  hlsUrl: z.string().url().optional(),
});

/**
 * Ingest: build the reel, embed it, put it in the vector index, make it
 * recommendable. The hype filter runs at ingest as well as at retrieval, so a
 * contributor sees immediately whether their own copy reads as a promise.
 */
export async function POST(request: Request) {
  const auth = await requireApiAccount();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reel", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const hype = detectHype(`${input.title}\n${input.caption}\n${input.transcript}`);

  // Substance is estimated, not asserted by the uploader: length of concrete
  // content, a stated outcome, and the absence of hype language.
  const wordCount = input.transcript.split(/\s+/).length;
  const substance = Math.max(
    0,
    Math.min(
      1,
      (Math.min(wordCount, 120) / 120) * 0.55 + (input.outcome ? 0.3 : 0) + 0.15 - hype.score * 0.85,
    ),
  );

  const hue = Math.floor(Math.random() * 360);
  const reel: Reel = {
    id: `ugc-${Date.now().toString(36)}`,
    title: input.title,
    creator: { handle: input.creatorHandle, name: input.creatorName, hue },
    durationSec: input.durationSec,
    caption: input.caption,
    transcript: input.transcript,
    hashtags: [],
    category: input.category,
    topics: input.topics,
    difficulty: input.difficulty,
    lane: "catalog",
    genre: "coding",
    substance: Number(substance.toFixed(2)),
    hypeMarkers: hype.matched,
    outcome: input.outcome,
    prerequisites: input.prerequisites,
    media: {
      poster: { from: hue, to: (hue + 40) % 360, angle: 140 },
      ...(input.hlsUrl ? { hlsUrl: input.hlsUrl } : {}),
      ...(input.storageKey
        ? { storageKey: input.storageKey, mp4Url: publicUrlFor(input.storageKey) }
        : {}),
    },
    stats: { likes: 0, saves: 0, plays: 0 },
    publishedAt: new Date().toISOString(),
    userGenerated: true,
  };

  registerRuntimeReel(reel);
  await addReel(reel);

  try {
    await indexReel(reel);
  } catch (err) {
    console.error("[upload] indexing failed:", err);
    return NextResponse.json(
      { error: "Saved, but could not be indexed for retrieval.", reel },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    reel,
    storage: storageDriver(),
    quality: {
      substance: reel.substance,
      hypeScore: hype.score,
      blocked: hype.blocked,
      hypeMatched: hype.matched,
      note: hype.blocked
        ? "This reel trips the hype filter and will never be recommended. Rewrite the promise as a lesson."
        : substance < 0.45
          ? "Below the substance floor — add a concrete outcome so it can be recommended."
          : "Indexed and recommendable.",
    },
  });
}
