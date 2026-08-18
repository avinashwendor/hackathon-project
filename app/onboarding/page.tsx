import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { requireAccount } from "@/lib/auth";
import { readSocial } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get started · Upstream",
  description: "Set your learning interests for a personalized feed.",
};

export default async function OnboardingPage() {
  const viewer = await requireAccount("/onboarding");
  const social = await readSocial(viewer.sessionId);
  if (social.onboarding?.completedAt) redirect("/feed");

  return (
    <main className="min-h-dvh bg-bg">
      <OnboardingForm />
    </main>
  );
}
