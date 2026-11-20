import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { crispEmailSignature } from "./crisp-identity";
import { WELCOME_WINDOW_DAYS, welcomeRefusal, type WelcomeFacts } from "./onboarding-welcome";

/**
 * Who gets the live chat's onboarding welcome (ticket 2026-11-19, item 6):
 * new, own workspace, not a customer, setup unfinished, never welcomed, no
 * conversation. The atomic claim itself is in onboarding-welcome.postgres.test.ts.
 */

const NOW = new Date("2026-11-19T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

const fresh = (extra: Partial<WelcomeFacts> = {}): WelcomeFacts => ({
  accountCreatedAt: new Date(NOW.getTime() - 60_000),
  ownsWorkspace: true,
  isCustomer: false,
  setupComplete: false,
  welcomedAt: null,
  firstMessageAt: null,
  ...extra,
});

describe("welcomeRefusal", () => {
  it("welcomes a new account with its own workspace and unfinished setup", () => {
    expect(welcomeRefusal(fresh(), NOW)).toBeNull();
    expect(welcomeRefusal(fresh({ accountCreatedAt: new Date(NOW.getTime() - WELCOME_WINDOW_DAYS * day + 1000) }), NOW)).toBeNull();
  });

  it("never welcomes twice", () => {
    expect(welcomeRefusal(fresh({ welcomedAt: new Date(NOW.getTime() - day) }), NOW)).toBe("welcomed");
  });

  it("skips anyone who already has a conversation", () => {
    expect(welcomeRefusal(fresh({ firstMessageAt: new Date(NOW.getTime() - 1000) }), NOW)).toBe("conversation");
  });

  it("skips accounts older than the window", () => {
    expect(welcomeRefusal(fresh({ accountCreatedAt: new Date(NOW.getTime() - WELCOME_WINDOW_DAYS * day - 1000) }), NOW)).toBe("not_new");
  });

  it("skips customers, guests on someone else's site, and finished setups", () => {
    expect(welcomeRefusal(fresh({ isCustomer: true }), NOW)).toBe("customer");
    expect(welcomeRefusal(fresh({ ownsWorkspace: false }), NOW)).toBe("guest");
    expect(welcomeRefusal(fresh({ setupComplete: true }), NOW)).toBe("setup_complete");
  });
});

describe("crispEmailSignature", () => {
  it("is HMAC-SHA256 of the email in hex, as Crisp's identity verification requires", () => {
    const expected = createHmac("sha256", "s3cret").update("a@example.com").digest("hex");
    expect(crispEmailSignature("a@example.com", "s3cret")).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs nothing without the secret", () => {
    expect(crispEmailSignature("a@example.com", undefined)).toBeNull();
    expect(crispEmailSignature("a@example.com", "  ")).toBeNull();
  });
});
