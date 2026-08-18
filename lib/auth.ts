import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/lib/auth-cookie";
import { getAccountByEmail, getAccountById, saveAccount, type Account } from "@/lib/store";

/* ---------------------------------------------------------------------------
   Authentication.

   Deliberately dependency-free and deliberately boring: scrypt for password
   hashing, an HMAC-signed session cookie, constant-time comparison everywhere a
   secret is checked.

   The interesting decision is what an account is *for* here. Upstream watches
   what you watch, so an account exists to give that record an owner who can
   read and delete it. The feed is gated: you sign up, then you scroll.
--------------------------------------------------------------------------- */

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "upstream_sid";
export { AUTH_COOKIE };
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * In production this must be set. In development a per-process random secret is
 * fine — it only means sessions do not survive a restart, which is the correct
 * trade against shipping a hardcoded default that would be a real vulnerability.
 */
const SECRET =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => {
        console.warn(
          "[auth] AUTH_SECRET is not set — sessions will not survive a restart or scale beyond one instance.",
        );
        return randomBytes(32).toString("hex");
      })()
    : randomBytes(32).toString("hex"));

/* --- Passwords ----------------------------------------------------------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, which would leak through an exception path.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/* --- Tokens -------------------------------------------------------------- */

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueToken(accountId: string): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${accountId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string): { accountId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [accountId, expiresRaw, signature] = parts;
  const payload = `${accountId}.${expiresRaw}`;

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  return { accountId };
}

/* --- Validation ---------------------------------------------------------- */

export interface CredentialIssue {
  field: "email" | "password" | "name";
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateCredentials(input: {
  email: string;
  password: string;
  name?: string;
}): CredentialIssue[] {
  const issues: CredentialIssue[] = [];
  if (!EMAIL_RE.test(input.email) || input.email.length > 254) {
    issues.push({ field: "email", message: "That does not look like an email address." });
  }
  if (input.password.length < 8) {
    issues.push({ field: "password", message: "Use at least 8 characters." });
  }
  if (input.password.length > 200) {
    issues.push({ field: "password", message: "That is longer than 200 characters." });
  }
  if (input.name !== undefined && input.name.length > 60) {
    issues.push({ field: "name", message: "Keep the name under 60 characters." });
  }
  return issues;
}

/* --- Session ------------------------------------------------------------- */

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
  maxAge: SESSION_MAX_AGE,
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
