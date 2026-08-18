import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { InstagramProfile } from "@/components/profile/instagram-profile";
import { requireAccount } from "@/lib/auth";
import { EMPTY_SOCIAL, readEvents, readSocial } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Upstream profile.",
};

export default async function ProfilePage() {
  const viewer = await requireAccount("/profile");
  const account = viewer.account!;

  let social = EMPTY_SOCIAL;
  let events: Awaited<ReturnType<typeof readEvents>> = [];

  try {
    [social, events] = await Promise.all([
      readSocial(viewer.sessionId),
      readEvents(viewer.sessionId),
    ]);
  } catch (err) {
    console.error("[profile] failed to load session data:", err);
  }

  social = {
    ...EMPTY_SOCIAL,
    ...social,
    dislikeFeedback: social.dislikeFeedback ?? {},
    seenReels: social.seenReels ?? [],
  };

  if (!social.onboarding?.completedAt) redirect("/onboarding");

  return (
    <AppShell>
      <InstagramProfile
        account={{ id: account.id, email: account.email, name: account.name }}
        social={social}
        stats={{
          eventCount: events.length,
          watchedCount: new Set(events.map((e) => e.reelId)).size,
        }}
      />
    </AppShell>
  );
}
