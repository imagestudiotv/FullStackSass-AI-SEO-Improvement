import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { articles, backlinkRequests, organization, placements, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { partnerLinkUrls } from "@/lib/backlinks/partner-links";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

async function site(name: string) {
  const orgId = `org_${name}_${randomUUID().slice(0, 6)}`;
  await test.db.insert(organization).values({ id: orgId, name, slug: orgId, createdAt: new Date() });
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, url: `https://${name}.test`, domain: `${name}.test`, status: "ready" })
    .returning({ id: websites.id });
  return row.id;
}

describe("the partner links an editor highlights", () => {
  it("are the placements whose link is in the text - not withdrawn or removed ones, nor other articles'", async () => {
    const host = await site(`host${randomUUID().slice(0, 4)}`);
    const partner = await site(`partner${randomUUID().slice(0, 4)}`);
    const [post] = await test.db.insert(articles).values({ websiteId: host, title: "Guide", status: "draft", bodyHtml: "<p>x</p>" }).returning({ id: articles.id });
    const [other] = await test.db.insert(articles).values({ websiteId: host, title: "Other", status: "draft", bodyHtml: "<p>y</p>" }).returning({ id: articles.id });

    const statuses = ["drafted", "published", "live", "unverified", "cancelled", "removed"] as const;
    for (const status of statuses) {
      const [request] = await test.db
        .insert(backlinkRequests)
        .values({ websiteId: partner, targetUrl: `https://partner.test/${status}/`, status: "matched", creditsReserved: 1 })
        .returning({ id: backlinkRequests.id });
      await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: host, articleId: post.id, anchor: "words", credits: 1, status, managed: true });
    }
    const [elsewhere] = await test.db
      .insert(backlinkRequests)
      .values({ websiteId: partner, targetUrl: "https://partner.test/other-article/", status: "matched", creditsReserved: 1 })
      .returning({ id: backlinkRequests.id });
    await test.db.insert(placements).values({ requestId: elsewhere.id, hostWebsiteId: host, articleId: other.id, anchor: "w", credits: 1, status: "drafted", managed: true });

    expect((await partnerLinkUrls(post.id)).sort()).toEqual([
      "https://partner.test/drafted/",
      "https://partner.test/live/",
      "https://partner.test/published/",
      "https://partner.test/unverified/",
    ]);
    expect(await partnerLinkUrls(randomUUID())).toEqual([]);
  });
});
