import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForYouExperience } from "@/components/agent/for-you-experience";
import { AppShell } from "@/components/app/app-shell";
import { requireAccount } from "@/lib/auth";
import { readSocial } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For you",
  description: "Personalized reel recommendation from your watch history.",
};

export default async function AgentPage() {
  const viewer = await requireAccount("/agent");
  const social = await readSocial(viewer.sessionId);
  if (!social.onboarding?.completedAt) redirect("/onboarding");

  return (
    <AppShell>
      <ForYouExperience />
    </AppShell>
  );
}
