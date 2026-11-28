import { describe, expect, it } from "vitest";

import { countedSteps, setupProgress } from "./progress";

/**
 * One set-up count for the sidebar, the Setup page, the tracker and Tasks:
 * required steps only, never the "Launched live" summary row, never an
 * optional step (Search Console) either way.
 */
const step = (id: string, done: boolean, optional = false) => ({ id, done, optional });

describe("setupProgress", () => {
  const steps = [
    step("profile", true),
    step("site", true),
    step("search-console", false, true),
    step("audit", true),
    step("articles", true),
    step("preferences", false),
    step("backlinks", false),
    step("prompts", false),
    step("launched", false),
  ];

  it("counts the required steps only, so done + remaining = total", () => {
    expect(setupProgress(steps)).toEqual({ done: 4, total: 7, remaining: 3 });
    expect(countedSteps(steps).map((s) => s.id)).not.toContain("launched");
    expect(countedSteps(steps).map((s) => s.id)).not.toContain("search-console");
  });

  it("an optional step done does not move the count, and the summary row never does", () => {
    const connected = steps.map((s) => (s.id === "search-console" || s.id === "launched" ? { ...s, done: true } : s));
    expect(setupProgress(connected)).toEqual(setupProgress(steps));
  });

  it("is finished exactly when nothing required is left", () => {
    const all = steps.map((s) => (s.optional ? s : { ...s, done: true }));
    expect(setupProgress(all)).toEqual({ done: 7, total: 7, remaining: 0 });
  });
});
