import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/auth-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to Upstream to open your feed.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthExperience mode="login" />
    </Suspense>
  );
}
