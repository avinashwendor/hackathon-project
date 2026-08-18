import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  currentAnonymousSession,
  getAccountByEmail,
  hashPassword,
  saveAccount,
  setAuthCookie,
  validateCredentials,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { migrateSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
  name: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const limited = await rateLimit(request, { key: "signup", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const issues = validateCredentials({ ...parsed.data, email });
  if (issues.length) return NextResponse.json({ issues }, { status: 422 });

  if (await getAccountByEmail(email)) {
    // Deliberately the same shape as a validation issue rather than a distinct
    // error: it still discloses that the address exists, which is unavoidable
    // for a signup form, but it does not leak anything further.
    return NextResponse.json(
      { issues: [{ field: "email", message: "That email already has an account." }] },
      { status: 409 },
    );
  }

  const account = {
    id: `u_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    email,
    name: parsed.data.name?.trim() || email.split("@")[0],
    passwordHash: await hashPassword(parsed.data.password),
    createdAt: new Date().toISOString(),
  };

  await saveAccount(account);

  // Carry the scroll session across, so signing up mid-feed keeps everything
  // the agent has learned rather than resetting the profile to empty.
  const anonymous = await currentAnonymousSession();
  const migrated = anonymous ? await migrateSession(anonymous, account.id) : 0;

  await setAuthCookie(account.id);

  return NextResponse.json({
    account: { id: account.id, email: account.email, name: account.name },
    migratedEvents: migrated,
  });
}
