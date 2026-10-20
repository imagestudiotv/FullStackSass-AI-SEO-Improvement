import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articleIndexing, articles } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * A published article's page shows its Google indexing (client, 2026-10-20),
 * from its latest request; an article never sent shows nothing; another
 * website's request is never shown.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { ArticleIndexingStatus } from "./indexing-status";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from article_indexing; delete from articles;");
});

async function published(websiteId: string) {
  const [row] = await test.db
    .insert(articles)
    .values({ websiteId, title: "Building a music video crew", status: "published", publishedUrl: "https://site.test/crew/", firstLiveAt: new Date("2026-10-16T10:23:39Z") })
    .returning();
  return row;
}

const render = async (websiteId: string, articleId: string, locale: "en" | "it" = "en") => {
  const element = await ArticleIndexingStatus({ websiteId, articleId, locale });
  return element ? renderToStaticMarkup(element) : "";
};

describe("an article's Google indexing on its page", () => {
  it("shows its latest request, in the reader's language", async () => {
    const { websiteId } = await seedWebsite(test);
    const article = await published(websiteId);
    await test.db.insert(articleIndexing).values({
      articleId: article.id,
      websiteId,
      url: "https://site.test/old-address/",
      status: "not_indexed",
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    await test.db.insert(articleIndexing).values({
      articleId: article.id,
      websiteId,
      url: "https://site.test/crew/",
      status: "submitted",
      submittedAt: new Date("2026-10-16T12:20:02Z"),
      createdAt: new Date("2026-10-16T12:20:01Z"),
    });
    const html = await render(websiteId, article.id);
    expect(html).toContain('aria-label="Google indexing"');
    expect(html).toContain("Sent to Google on 16 October 2026.");
    expect(await render(websiteId, article.id, "it")).toContain("Inviato a Google il 16 ottobre 2026.");
  });

  it("shows nothing for an article never sent, or for another website", async () => {
    const { websiteId } = await seedWebsite(test);
    const article = await published(websiteId);
    expect(await render(websiteId, article.id)).toBe("");
    await test.db.insert(articleIndexing).values({ articleId: article.id, websiteId, url: "https://site.test/crew/", status: "indexed", indexedAt: new Date() });
    expect(await render(websiteId, article.id)).toContain("Indexed by Google on");
    const other = await seedWebsite(test);
    expect(await render(other.websiteId, article.id)).toBe("");
  });
});
