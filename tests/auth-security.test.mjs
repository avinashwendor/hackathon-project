import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashPassword,
  issueToken,
  readToken,
  validateCredentials,
  verifyPassword,
} from "@/lib/auth-crypto";
import { AUTH_COOKIE } from "@/lib/auth-cookie";
import { rateLimit } from "@/lib/rate-limit";

describe("credential validation", () => {
  it("rejects malformed email, short passwords, and oversized names", () => {
    const issues = validateCredentials({
      email: "not-an-email",
      password: "short",
      name: "x".repeat(61),
    });
    assert.ok(issues.some((i) => i.field === "email"));
    assert.ok(issues.some((i) => i.field === "password"));
    assert.ok(issues.some((i) => i.field === "name"));
  });

  it("accepts a normal signup payload", () => {
    assert.deepEqual(
      validateCredentials({ email: "ada@example.com", password: "correct-horse", name: "Ada" }),
      [],
    );
  });

  it("rejects passwords longer than 200 characters (DoS via scrypt)", () => {
    const issues = validateCredentials({
      email: "ada@example.com",
      password: "p".repeat(201),
    });
    assert.ok(issues.some((i) => i.field === "password"));
  });
});

describe("scrypt passwords", () => {
  it("hashes with a unique salt and verifies in constant time", async () => {
    const a = await hashPassword("hunter2-long");
    const b = await hashPassword("hunter2-long");
    assert.match(a, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    assert.notEqual(a, b, "salts must differ or a leaked hash is reusable");
    assert.equal(await verifyPassword("hunter2-long", a), true);
    assert.equal(await verifyPassword("wrong-password", a), false);
  });

  it("refuses a truncated or foreign hash instead of throwing", async () => {
    assert.equal(await verifyPassword("x", "bcrypt$not$ours"), false);
    assert.equal(await verifyPassword("x", "scrypt$aa"), false);
  });
});

describe("HMAC session tokens", () => {
  it("round-trips a signed account id", () => {
    const token = issueToken("acct-1");
    assert.deepEqual(readToken(token), { accountId: "acct-1" });
  });

  it("rejects a tampered signature and a truncated token", () => {
    const token = issueToken("acct-1");
    const parts = token.split(".");
    parts[2] = "aaaa";
    assert.equal(readToken(parts.join(".")), null);
    assert.equal(readToken("not.a.token.extra"), null);
    assert.equal(readToken(""), null);
  });

  it("exports the cookie name middleware can import without Node crypto", () => {
    assert.equal(AUTH_COOKIE, "upstream_auth");
  });
});

describe("in-process rate limit", () => {
  it("allows traffic under the budget and 429s once it is spent", async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const request = new Request("http://localhost/api/login", {
      headers: { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200)}` },
    });

    assert.equal(await rateLimit(request, { key, limit: 2, windowMs: 60_000 }), null);
    assert.equal(await rateLimit(request, { key, limit: 2, windowMs: 60_000 }), null);

    const limited = await rateLimit(request, { key, limit: 2, windowMs: 60_000 });
    assert.ok(limited);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("X-RateLimit-Limit"), "2");
    assert.ok(limited.headers.get("Retry-After"));
  });
});
