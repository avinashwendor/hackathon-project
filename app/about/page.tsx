import type { Metadata } from "next";
import { LandingPage } from "@/components/home/landing-page";

export const metadata: Metadata = {
  title: "About",
  description: "Upstream reads why you watched, not what you watched.",
};

export default function AboutPage() {
  return <LandingPage />;
}
