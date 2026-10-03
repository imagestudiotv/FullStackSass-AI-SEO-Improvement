import { describe, expect, it } from "vitest";

import { isPreviewDeployment, PREVIEW_ROBOTS_HEADER } from "./deployment";

/**
 * Previews stay out of search engines; production NEVER does by mistake
 * (client's launch review, 2026-10-03: "staging noindex").
 */

describe("isPreviewDeployment", () => {
  it("is true only when Vercel says preview", () => {
    expect(isPreviewDeployment("preview")).toBe(true);
  });

  it("is false for production", () => {
    expect(isPreviewDeployment("production")).toBe(false);
  });

  /**
   * The safety rule: a missing or unexpected value must leave the site
   * indexable. Hiding production from Google by mistake is far worse than a
   * preview being found.
   */
  it("is false when the variable is missing, empty or unexpected", () => {
    expect(isPreviewDeployment(undefined)).toBe(false);
    expect(isPreviewDeployment("")).toBe(false);
    expect(isPreviewDeployment("development")).toBe(false);
    expect(isPreviewDeployment("Preview")).toBe(false);
    expect(isPreviewDeployment("staging")).toBe(false);
  });
});

describe("PREVIEW_ROBOTS_HEADER", () => {
  it("tells crawlers not to index or follow", () => {
    expect(PREVIEW_ROBOTS_HEADER).toEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });
});
