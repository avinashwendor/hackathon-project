import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cn, formatCount, formatDuration, formatFeedTime, relativeTime, seeded } from "@/lib/utils";

describe("display helpers", () => {
  it("formats play counts the way Instagram does", () => {
    assert.equal(formatCount(42), "42");
    assert.equal(formatCount(1_200), "1.2K");
    assert.equal(formatCount(12_000), "12K");
    assert.equal(formatCount(1_500_000), "1.5M");
    assert.equal(formatCount(12_000_000), "12M");
  });

  it("pads seconds so reel timestamps stay aligned", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(9), "0:09");
    assert.equal(formatDuration(75), "1:15");
  });

  it("merges tailwind classes without leaving conflicting utilities", () => {
    assert.equal(cn("px-2", "px-4"), "px-4");
    assert.ok(cn("text-fg", false && "hidden", "font-medium").includes("font-medium"));
  });

  it("returns a stable pseudo-random stream for generated art", () => {
    const a = seeded("poster-a")();
    const b = seeded("poster-a")();
    const c = seeded("poster-b")();
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.ok(a >= 0 && a < 1);
  });

  it("describes recent timestamps in relative English", () => {
    const now = new Date().toISOString();
    assert.equal(relativeTime(now), "just now");
    const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    assert.match(relativeTime(hourAgo), /1h ago/);
    assert.match(formatFeedTime(now), /JUST NOW/);
    assert.match(formatFeedTime(hourAgo), /HOUR/);
  });
});
