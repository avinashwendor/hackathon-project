import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/lib/auth-cookie";
import {
  SESSION_MAX_AGE_SEC,
  hashPassword,
  issueToken,
  readToken,
  validateCredentials,
  verifyPassword,
  type CredentialIssue,
} from "@/lib/auth-crypto";
import { getAccountByEmail, getAccountById, saveAccount, type Account } from "@/lib/store";

/* ---------------------------------------------------------------------------
   Authentication session layer.

   Crypto lives in `lib/auth-crypto.ts`. This file only binds those primitives
   to Next.js cookies so a unit test can exercise hashing without a request.
--------------------------------------------------------------------------- */

export const SESSION_COOKIE = "upstream_sid";
export { AUTH_COOKIE, hashPassword, issueToken, readToken, validateCredentials, verifyPassword };
export type { CredentialIssue };

export interface Viewer {
  /** Always present — the scroll session, signed in or not. */
  sessionId: string;
  account: Account | null;
}

function newSessionId(): string {
  return `s_${randomBytes(12).toString("hex")}`;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SEC,
};

/**
 * Resolve the current viewer. When signed in, the account id becomes the
 * storage key so the taste profile follows the person rather than the browser.
 */
export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();

  const authToken = jar.get(AUTH_COOKIE)?.value;
  if (authToken) {
    const claim = readToken(authToken);
    if (claim) {
      const account = await getAccountById(claim.accountId);
      if (account) return { sessionId: account.id, account };
    }
  }

  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) return { sessionId: existing, account: null };

  const sessionId = newSessionId();
  try {
    jar.set(SESSION_COOKIE, sessionId, COOKIE_OPTIONS);
  } catch {
    // Server components cannot set cookies; route handlers will.
  }
  return { sessionId, account: null };
}

/** The storage key for the current viewer — account id, or the anonymous session. */
export async function getStorageKey(): Promise<string> {
  return (await getViewer()).sessionId;
}

export async function setAuthCookie(accountId: string): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, issueToken(accountId), COOKIE_OPTIONS);
}

export async function clearAuthCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function currentAnonymousSession(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Feed, profile and the rest of the product are account-gated. Anonymous
 * scrolling is no longer a path — the taste profile needs an owner.
 */
export async function requireAccount(next = "/feed"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.account) {
    const target = next === "/feed" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
    redirect(target);
  }
  return viewer;
}

export { getAccountByEmail, getAccountById, saveAccount };
export type { Account };
