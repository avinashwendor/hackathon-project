import { NextResponse } from "next/server";
import { writeLocalObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Development sink for the local storage driver. In production S3 receives the
 * bytes directly and this route is never called.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const key = String(form.get("key") ?? "");

  if (!(file instanceof File) || !key) {
    return NextResponse.json({ error: "Expected a file and a key" }, { status: 400 });
  }
  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Only video uploads are accepted" }, { status: 415 });
  }

  const url = await writeLocalObject(key, await file.arrayBuffer());
  return NextResponse.json({ ok: true, key, url });
}
