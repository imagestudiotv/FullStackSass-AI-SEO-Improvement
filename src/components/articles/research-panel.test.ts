import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { articles } from "@/lib/db/schema";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/tenant", () => ({ requireWebsite: async (id: string) => ({ site: { id }, access: "viewer" }) }));
vi.mock("./research-approval", () => ({ ResearchApproval: () => null }));
import { ResearchPanel } from "./research-panel";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
describe("automatic correction disclosure", () => {
  it.each([true, false])("distinguishes applied=%s and retains initial findings without replacing the latest check", async applied => {
    const site = await seedWebsite(test);
    const [article] = await test.db.insert(articles).values({
      websiteId: site.websiteId, title: "Example", bodyHtml: "<p>Saved draft</p>", researchReviewRequired: true,
      research: { version: 1, mode: "pilot", status: "ready", question: "Question", intent: "informational",
        businessAngle: "", subquestions: [], sources: [], claims: [], warnings: [], checkedAt: "2026-10-20",
        quality: { checked: true, issues: ["Latest issue"] },
        correction: { attempted: true, applied, initialIssues: ["Earlier issue <script>bad()</script>"] } },
    }).returning();
    for (const locale of Object.keys(CONTENT_COPY) as (keyof typeof CONTENT_COPY)[]) {
      const html = renderToStaticMarkup(await ResearchPanel({ websiteId: site.websiteId, articleId: article.id, locale }));
      expect(html).toContain(CONTENT_COPY[locale][applied ? "corrected" : "correctionFailed"]);
      expect(html).toContain("Latest issue");
      expect(html).toContain("Earlier issue &lt;script&gt;");
      expect(html).not.toContain("<script>");
      expect(html).toContain(CONTENT_COPY[locale].held);
    }
  });
});
