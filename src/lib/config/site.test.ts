import { afterEach, describe, expect, it, vi } from "vitest";

/** The support address on the contact and legal pages (lib/config/site.ts). */

async function load() {
  vi.resetModules();
  return import("./site");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the support address", () => {
  it("is RepGet's own inbox when no address is configured", async () => {
    for (const value of [undefined, ""]) {
      vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", value);
      const site = await load();
      expect(site.SUPPORT_EMAIL).toBe("support@repget.com");
      expect(site.hasRealSupportEmail()).toBe(true);
    }
  });

  it("is the configured one when there is one, and a placeholder is still recognised", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "help@repget.com");
    expect((await load()).SUPPORT_EMAIL).toBe("help@repget.com");

    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.com");
    expect((await load()).hasRealSupportEmail()).toBe(false);
  });
});
