import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/home/landing-page";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upstream — scroll-native learning",
  description: "Upstream reads why you watched, not what you watched.",
};

export default async function Home() {
  const { account } = await getViewer();
  if (account) redirect("/feed");

  return <LandingPage />;
}
