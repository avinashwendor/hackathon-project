import { NextResponse } from "next/server";
import { z } from "zod";
import {
  categoriesFromTopics,
  isValidLegacyOnboarding,
  isValidOnboarding,
  VIABLE_DIFFICULTIES,
} from "@/lib/onboarding/catalog-options";
import { getViewer } from "@/lib/auth";
import { readSocial, updateSocial } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sharedFields = {
  topics: z.array(z.string()).min(1).max(8),
  motivation: z.string().min(1),
  difficulty: z.enum(VIABLE_DIFFICULTIES as unknown as [string, ...string[]]),
  goal: z.string().min(4).max(200),
};

const bodySchema = z.union([
  z.object({
    ...sharedFields,
    clusters: z.array(z.string()).min(1).max(4),
  }),
  z.object({
    ...sharedFields,
    categories: z.array(z.string()).min(1).max(8),
  }),
]);

export async function GET() {
  const { sessionId, account } = await getViewer();
  if (!account) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const social = await readSocial(sessionId);
  return NextResponse.json({ onboarding: social.onboarding ?? null });
}

export async function POST(request: Request) {
  const { sessionId, account } = await getViewer();
  if (!account) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload" }, { status: 400 });
  }

  const { topics, motivation, difficulty, goal } = parsed.data;
  const clusters = "clusters" in parsed.data ? parsed.data.clusters : [];
  const categories =
    "categories" in parsed.data && parsed.data.categories.length
      ? parsed.data.categories
      : categoriesFromTopics(topics);

  if ("clusters" in parsed.data) {
    const validationError = isValidOnboarding({
      clusterIds: clusters,
      topics,
      motivation,
      difficulty,
      goal,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  } else {
    const validationError = isValidLegacyOnboarding({
      topics,
      motivation,
      difficulty,
      goal,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const onboarding = {
    completedAt: new Date().toISOString(),
    ...(clusters.length ? { clusters } : {}),
    categories,
    topics,
    motivation,
    difficulty,
    goal,
  };

  await updateSocial(sessionId, (current) => ({ ...current, onboarding }));

  return NextResponse.json({ ok: true, onboarding });
}
