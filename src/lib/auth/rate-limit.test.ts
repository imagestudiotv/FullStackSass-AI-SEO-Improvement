import { describe, expect, it } from "vitest";

import { AUTH_IP_HEADERS, authRateLimit, OTP_RATE_LIMIT } from "./rate-limit";

/** The stated limits (client's launch review, 2026-10-03: "explicit rate limits"). */
describe("authRateLimit", () => {
  it("is on for every deployed build, off for next dev and tests", () => {
    expect(authRateLimit("production").enabled).toBe(true);
    for (const env of ["development", "test", undefined, ""]) {
      expect(authRateLimit(env).enabled).toBe(false);
    }
  });

  it("names the limit on each sign-in door, tighter than Better Auth's defaults", () => {
    expect(authRateLimit("production")).toEqual({
      enabled: true,
      storage: "memory",
      window: 10,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 600, max: 10 },
        "/change-password": { window: 60, max: 5 },
        "/sign-in/social": { window: 60, max: 10 },
      },
    });
  });

  it("allows 3 one-time-code requests a minute", () => {
    expect(OTP_RATE_LIMIT).toEqual({ window: 60, max: 3 });
  });

  it("reads the visitor's address as the rest of the app does: x-real-ip first", () => {
    expect(AUTH_IP_HEADERS).toEqual(["x-real-ip", "x-forwarded-for"]);
  });
});
