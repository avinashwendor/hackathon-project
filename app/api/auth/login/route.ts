import { NextResponse } from "next/server";
import { z } from "zod";
import {
  currentAnonymousSession,
  getAccountByEmail,
  setAuthCookie,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { migrateSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().max(254), password: z.string().max(200) });

export async function POST(request: Request) {
  const limited = await rateLimit(request, { key: "login", limit: 8, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const account = await getAccountByEmail(parsed.data.email);

  // Always run a verification so a missing account and a wrong password take
  // roughly the same time — otherwise the response time enumerates addresses.
  const ok = account
    ? await verifyPassword(parsed.data.password, account.passwordHash)
    : await verifyPassword(parsed.data.password, `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`);

  if (!account || !ok) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const anonymous = await currentAnonymousSession();
  const migrated = anonymous ? await migrateSession(anonymous, account.id) : 0;

  await setAuthCookie(account.id);

  return NextResponse.json({
    account: { id: account.id, email: account.email, name: account.name },
    migratedEvents: migrated,
  });
}
