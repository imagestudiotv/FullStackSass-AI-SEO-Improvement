import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { articles } from "@/lib/db/schema";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
const state = vi.hoisted(() => ({ db: null as unknown, access: "viewer" }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/tenant", () => ({ requireWebsite: async (id: string) => ({ site: { id }, access: state.access }) }));
vi.mock("./research-approval", () => ({ ResearchApproval: () => "Research approval control" }));
import { ResearchPanel } from "./research-panel";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
beforeEach(() => { state.access = "viewer"; });
it.each(["draft", "published", "generating"])("shows an editor's approval control only for a finished %s revision", async status => {
  const site = await seedWebsite(test);
  const [article] = await test.db.insert(articles).values({ websiteId: site.websiteId, title: "Changed article", bodyHtml: "<p>Saved content</p>", status, researchReviewRequired: true }).returning();
  const props = { websiteId: site.websiteId, articleId: article.id, locale: "en" as const };
  expect(renderToStaticMarkup(await ResearchPanel(props))).not.toContain("Research approval control");
  state.access = "editor";
  const html = renderToStaticMarkup(await ResearchPanel(props));
  expect(html.includes("Research approval control")).toBe(status !== "generating");
});
describe("automatic correction disclosure", () => {
  it.each([true, false])("distinguishes applied=%s and retains initial findings without replacing the latest check", async applied => {
    const site = await seedWebsite(test);
    const [article] = await test.db.insert(articles).values({
      websiteId: site.websiteId, title: "Example", bodyHtml: "<p>Saved draft</p>", researchReviewRequired: true,
      research: { version: 1, mode: "pilot", status: "ready", question: "Question", intent: "informational",
        businessAngle: "", subquestions: [], sources: [], claims: [], warnings: [], checkedAt: "2026-10-20",
        quality: { checked: true, issues: ["Latest issue"] },
        correction: { attempted: true, applied, initialIssues: ["Earlier issue <script>bad()</script>"],
          followUp: { applied, issues: ["Finding after the first revision"] } } },
    }).returning();
    for (const locale of Object.keys(CONTENT_COPY) as (keyof typeof CONTENT_COPY)[]) {
      const html = renderToStaticMarkup(await ResearchPanel({ websiteId: site.websiteId, articleId: article.id, locale }));
      expect(html).toContain(CONTENT_COPY[locale][applied ? "corrected" : "correctionFailed"]);
      expect(html).toContain("Latest issue");
      expect(html).toContain("Earlier issue &lt;script&gt;");
      expect(html).toContain(CONTENT_COPY[locale].followUpFindings);
      expect(html).toContain("Finding after the first revision");
      if (!applied) expect(html).toContain(CONTENT_COPY[locale].followUpFailed);
      expect(html).not.toContain("<script>");
      expect(html).toContain(CONTENT_COPY[locale].held);
    }
  });
});
