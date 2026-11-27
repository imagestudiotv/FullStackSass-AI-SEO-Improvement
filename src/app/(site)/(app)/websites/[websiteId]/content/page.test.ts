import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PageHeader } from "@/components/ui/page-header";
import { ResearchStatus } from "@/components/articles/research-status";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Planned Articles opens with its heading, then the "Research before
 * writing" notice (outside review, 2026-11-27: the page had no heading and
 * opened on the notice).
 */

vi.mock("@/lib/tenant", () => ({
  requireWebsitePage: async (id: string) => ({ userId: "u1", access: "owner", site: { id, domain: "acme.com", status: "ready", organizationId: "o1" } }),
}));
vi.mock("@/lib/billing/require-plan", () => ({ requireWebsitePlan: async () => undefined }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages: messages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "it", t: messages("it") }) };
});
vi.mock("@/lib/articles/actions", () => ({ listArticles: async () => [] }));
vi.mock("@/lib/keywords/actions", () => ({ listKeywords: async () => [], listCalendar: async () => [] }));
vi.mock("@/lib/keywords/replan", () => ({ articlesToPlan: async () => ({ usedUp: false }) }));
vi.mock("@/lib/keywords/research-state", () => ({ researchInFlight: () => false }));
vi.mock("@/lib/articles/research-types", () => ({ researchMode: () => "on" }));
vi.mock("../research-tabs", () => ({ ResearchTabs: () => null }));

import WebsiteContentPage from "./page";

describe("Planned Articles", () => {
  it("starts with the page heading in the reader's language, the research notice under it", async () => {
    const page = (await WebsiteContentPage({ params: Promise.resolve({ websiteId: "w1" }) } as never)) as ReactElement<{ children: ReactNode }>;
    const children = (Array.isArray(page.props.children) ? page.props.children : [page.props.children]).filter(isValidElement) as ReactElement<Record<string, unknown>>[];
    expect(children[0].type).toBe(PageHeader);
    expect(children[0].props.title).toBe(getMessages("it").app.nav.plannedArticles);
    expect(children[1].type).toBe(ResearchStatus);
  });
});
