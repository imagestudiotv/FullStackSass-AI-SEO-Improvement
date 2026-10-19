import { describe, expect, it } from "vitest";
import { websiteSwitchDestination } from "./switch-destination";

describe("switching websites", () => {
  it("opens the destination content list from an article", () => {
    expect(websiteSwitchDestination("/websites/old/articles/old-article", "new")).toBe("/websites/new/content");
  });
  it.each(["content", "profile", "publishing", "integrations", "google", "ai-visibility", "traffic", "backlinks/links", "backlinks/credits"])("preserves the shared %s section", (section) => {
    expect(websiteSwitchDestination(`/websites/old/${section}`, "new")).toBe(`/websites/new/${section}`);
  });
  it("does not copy an unknown resource path", () => {
    expect(websiteSwitchDestination("/websites/old/audits/old-audit", "new")).toBe("/websites/new");
  });
  it("selects the requested dashboard from account pages", () => {
    expect(websiteSwitchDestination("/settings", "new", "first")).toBe("/dashboard?site=new");
    expect(websiteSwitchDestination("/dashboard", "first", "first")).toBe("/dashboard");
  });
});
