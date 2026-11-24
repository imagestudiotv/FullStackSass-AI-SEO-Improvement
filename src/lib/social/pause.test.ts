import { describe, expect, it } from "vitest";

import { pauseKind, resumesAt } from "./pause";

/**
 * Which pauses start again by themselves (2026-11-24): only our posting
 * provider's own limits. Every platform refusal, and every reason nobody has
 * classified, waits for a person (the anti-ban rule).
 */

describe("a pause's reason", () => {
  it.each([
    "bundle.social POST /post/ failed (403): Monthly post limit reached. Limit for this month is 20 posts.",
    "Not enough credits to publish this X post. Add funds to your balance and try again.",
  ])("is the provider's limit: %s", (reason) => {
    expect(pauseKind(reason)).toBe("quota");
  });

  it.each([
    "Duplicate content",
    "This account is suspended",
    "You have reached your daily post limit on Reddit",
    "Rate limit exceeded",
    "Your post was flagged as spam",
    "bundle.social POST /post/ failed (403): The account was disconnected",
    "bundle.social POST /post/ failed (401): Access token revoked",
    "bundle.social POST /post/ failed (400): text is too long",
    "Monthly post limit reached because this account is restricted",
    "",
    null,
  ])("is the platform's, or not known to be safe: %s", (reason) => {
    expect(pauseKind(reason)).toBe("platform");
    expect(resumesAt(reason, new Date("2026-11-20T10:00:00Z"))).toBeNull();
  });
});

describe("a provider limit is tried again", () => {
  const limit = "Monthly post limit reached. Limit for this month is 20 posts.";
  it("after three days", () => {
    expect(resumesAt(limit, new Date("2026-11-20T10:00:00Z"))).toEqual(new Date("2026-11-23T10:00:00Z"));
  });
  it("or on the first of the next month, if that is sooner", () => {
    expect(resumesAt(limit, new Date("2026-11-29T10:00:00Z"))).toEqual(new Date("2026-12-01T00:00:00Z"));
    expect(resumesAt(limit, new Date("2026-12-31T23:00:00Z"))).toEqual(new Date("2027-01-01T00:00:00Z"));
  });
});
