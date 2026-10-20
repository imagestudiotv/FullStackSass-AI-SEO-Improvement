import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/dashboard/next-actions", () => ({ getNextActions: mocks.load }));
vi.mock("@/lib/dashboard/next-action-actions", () => ({ snoozeNextAction: vi.fn(), restoreNextActions: vi.fn() }));
import { NextActions } from "./next-actions";
afterEach(() => vi.clearAllMocks());

describe("next-action presentation", () => {
  it("shows evidence, explanation, priority and reminders without hiding the article title", async () => {
    mocks.load.mockResolvedValue([{ id: "traffic:abc", kind: "traffic", priority: "medium", href: "/websites/a/articles/b",
      detail: "A useful guide", evidence: { metric: "clicks", before: 120, after: 75, end: "2026-10-17" } }]);
    const html = renderToStaticMarkup(await NextActions({ websiteId: "a", ownerOrgId: "org", canManage: true, locale: "en" }));
    expect(html).toContain("A useful guide");
    expect(html).toContain("The latest imported search data shows a decline");
    expect(html).toContain("120 → 75");
    expect(html).toContain("Remind me in 7 days");
    expect(html).toContain("Show postponed tasks");
  });
  it("uses the selected language and omits mutation controls for viewers", async () => {
    mocks.load.mockResolvedValue([{ id: "research:abc", kind: "research", priority: "high", href: "/websites/a/articles/b", detail: "Guía" }]);
    const html = renderToStaticMarkup(await NextActions({ websiteId: "a", ownerOrgId: "org", canManage: false, locale: "es" }));
    expect(html).toContain("Revisar la investigación");
    expect(html).toContain("Resolver primero");
    expect(html).not.toContain("<form");
  });
});
