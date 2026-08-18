import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/* ---------------------------------------------------------------------------
   Auth primitives (no Next.js).

   Cookie I/O lives in `lib/auth.ts`. Keeping hashing and HMAC here means the
   security contract can be unit-tested without a request context, and a
   missing AUTH_SECRET cannot hide behind a framework import.
--------------------------------------------------------------------------- */

const scryptAsync = promisify(scrypt);

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

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

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueToken(accountId: string): string {
  const expires = Date.now() + SESSION_MAX_AGE_SEC * 1000;
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
