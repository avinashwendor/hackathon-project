import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/auth-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create an account to open the feed.",
};

export default function SignupPage() {
  return (
    <Suspense>
      <AuthExperience mode="signup" />
    </Suspense>
  );
}
