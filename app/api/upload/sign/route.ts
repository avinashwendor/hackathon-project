import { NextResponse } from "next/server";
import { z } from "zod";
import { presignUpload } from "@/lib/storage";
import { requireApiAccount } from "@/lib/auth-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().default("video/mp4"),
  sizeBytes: z.number().positive().optional(),
});

const MAX_BYTES = 512 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireApiAccount();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (parsed.data.sizeBytes && parsed.data.sizeBytes > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 512MB limit" }, { status: 413 });
  }
  if (!parsed.data.contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Only video uploads are accepted" }, { status: 415 });
  }

  try {
    return NextResponse.json(await presignUpload(parsed.data.filename, parsed.data.contentType));
  } catch (err) {
    console.error("[upload] presign failed:", err);
    return NextResponse.json({ error: "Could not sign the upload" }, { status: 500 });
  }
}
