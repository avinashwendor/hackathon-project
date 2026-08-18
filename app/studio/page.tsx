import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { CreateExperience } from "@/components/studio/create-experience";
import { requireAccount } from "@/lib/auth";
import { readSocial } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create",
  description: "Share a new reel to your feed.",
};

export default async function StudioPage() {
  const viewer = await requireAccount("/studio");
  const social = await readSocial(viewer.sessionId);
  if (!social.onboarding?.completedAt) redirect("/onboarding");

  return (
    <AppShell>
      <CreateExperience />
    </AppShell>
  );
}
