import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { InstagramProfile } from "@/components/profile/instagram-profile";
import { requireAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Upstream profile.",
};

export default async function ProfilePage() {
  await requireAccount("/profile");

  return (
    <AppShell>
      <InstagramProfile />
    </AppShell>
  );
}
