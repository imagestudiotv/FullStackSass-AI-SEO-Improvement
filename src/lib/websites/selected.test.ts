import { describe, expect, it, vi } from "vitest";

/** resolveWebsiteId is pure; the cookie helpers beside it are not used here. */
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies should not be read by resolveWebsiteId");
  },
}));

import { resolveWebsiteId } from "./selected";

/**
 * Which website the sidebar is about. The caller decides which ids are
 * candidates - owned ones only, or owned then shared - and this only chooses
 * among them, never trusting an id that is not one.
 */

const OWNED_A = "11111111-1111-4111-8111-111111111111";
const OWNED_B = "22222222-2222-4222-8222-222222222222";
const SHARED = "33333333-3333-4333-8333-333333333333";
const FOREIGN = "44444444-4444-4444-8444-444444444444";

const candidates = [OWNED_A, OWNED_B, SHARED];

describe("resolveWebsiteId", () => {
  it("prefers the website named in the URL when it is a candidate", () => {
    expect(resolveWebsiteId(SHARED, OWNED_B, candidates)).toBe(SHARED);
  });

  it("falls back to the remembered website when the URL names none", () => {
    expect(resolveWebsiteId(null, OWNED_B, candidates)).toBe(OWNED_B);
  });

  it("ignores a URL id that is not a candidate, and uses the cookie", () => {
    expect(resolveWebsiteId(FOREIGN, SHARED, candidates)).toBe(SHARED);
  });

  it("ignores a remembered id that is not a candidate, and uses the first", () => {
    expect(resolveWebsiteId(null, FOREIGN, candidates)).toBe(OWNED_A);
  });

  it("does not select a shared site the caller left out of the candidates", () => {
    // Billing passes owned sites only: a remembered shared site must not win.
    expect(resolveWebsiteId(null, SHARED, [OWNED_A, OWNED_B])).toBe(OWNED_A);
  });

  it("returns null when there are no candidates", () => {
    expect(resolveWebsiteId(OWNED_A, OWNED_A, [])).toBeNull();
  });
});
