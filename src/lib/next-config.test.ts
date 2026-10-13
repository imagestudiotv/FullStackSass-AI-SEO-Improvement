import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

/** Settings in next.config.ts that are about what responses reveal. */
describe("next.config", () => {
  it("does not send X-Powered-By (live check, 2026-10-13: it named the framework on every per-request page)", async () => {
    const config = typeof nextConfig === "function" ? await (nextConfig as (phase: string, ctx: object) => Promise<object>)("phase-production-build", {}) : nextConfig;
    expect((config as { poweredByHeader?: boolean }).poweredByHeader).toBe(false);
  });
});
