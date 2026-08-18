import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { Suspense } from "react";
import { AuthExperience } from "@/components/auth/auth-experience";
import { resolveAuthPreviewMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { account } = await getViewer();
  if (account) redirect("/feed");
  const previewMedia = resolveAuthPreviewMedia();

  return (
    <Suspense>
      <AuthExperience mode="login" previewMedia={previewMedia} />
    </Suspense>
  );
}
