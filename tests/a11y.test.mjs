import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("accessibility coverage", () => {
  it("declares the document language and a skip link to #main", () => {
    const layout = read("app/layout.tsx");
    assert.match(layout, /lang="en"/);
    assert.match(layout, /href="#main"/);
    assert.match(layout, /Skip to content/);
    assert.match(layout, /sr-only/);
  });

  it("lands keyboard users on a main landmark in the app shell", () => {
    const shell = read("components/app/app-shell.tsx");
    assert.match(shell, /id="main"/);
    assert.match(shell, /aria-label="Main"/);
    assert.match(shell, /aria-current/);
  });

  it("labels feed playback controls instead of icon-only buttons", () => {
    const feed = read("components/feed/feed-experience.tsx");
    assert.match(feed, /aria-label=\{muted \? "Unmute" : "Mute"\}/);
    assert.match(feed, /aria-label="Pause or like"/);
    assert.match(feed, /aria-hidden/);
  });

  it("exposes invalid auth fields to assistive tech", () => {
    const auth = read("components/auth/auth-experience.tsx");
    assert.match(auth, /aria-invalid/);
    assert.match(auth, /role="alert"/);
    assert.match(auth, /sr-only/);
  });

  it("keeps a visible focus ring utility in the design system", () => {
    const css = read("app/globals.css");
    assert.match(css, /focus-ring/);
    assert.match(css, /prefers-reduced-motion/);
  });
});
