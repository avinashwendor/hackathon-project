import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/auth-experience";
import { resolveAuthPreviewMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to Upstream to open your feed.",
};

export default function LoginPage() {
  const previewMedia = resolveAuthPreviewMedia();

  return (
    <Suspense>
      <AuthExperience mode="login" previewMedia={previewMedia} />
    </Suspense>
  );
}
