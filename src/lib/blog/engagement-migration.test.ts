import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTestDb } from "@/test/db";

/**
 * The Nov 13 engagement migration (drizzle/0093, its engagement part) on
 * rows made before it: every post gets its article's discussion, upvotes and
 * comments are attached to it, a member's duplicate upvotes across language
 * versions become one - the first - with the others recorded, never dropped
 * silently; comments, their moderation and the credit ledger are untouched;
 * and running it twice changes nothing more.
 */

const EN = "a0000000-0000-4000-8000-000000000001";
const IT = "a0000000-0000-4000-8000-000000000002";
const ES = "a0000000-0000-4000-8000-000000000003";
const SOLO = "a0000000-0000-4000-8000-000000000009";

async function seeded() {
  const test = await createTestDb({ through: "0092_viral_social_content" });
  await test.client.exec(`
    insert into "user" (id, name, email) values ('m1','One','m1@x.test'), ('m2','Two','m2@x.test'), ('m3','Three','m3@x.test');
    insert into organization (id, name, slug, created_at) values ('org1','Org','org1', now());
    insert into blog_posts (id, slug, title, category, author, status, locale, translation_of) values
      ('${EN}', 'guide', 'Guide', 'Guides', 'RepGet team', 'published', 'en', null),
      ('${IT}', 'guida', 'Guida', 'Guides', 'RepGet team', 'published', 'it', '${EN}'),
      ('${ES}', 'guia', 'Guía', 'Guides', 'RepGet team', 'published', 'es', '${EN}'),
      ('${SOLO}', 'solo', 'Solo', 'Guides', 'RepGet team', 'published', 'it', null);
    insert into blog_post_upvotes (id, post_id, user_id, created_at) values
      ('c0000000-0000-4000-8000-000000000001', '${EN}', 'm1', '2026-11-01 10:00'),
      ('c0000000-0000-4000-8000-000000000002', '${IT}', 'm2', '2026-11-01 11:00'),
      ('c0000000-0000-4000-8000-000000000003', '${ES}', 'm2', '2026-11-01 09:00'),
      ('c0000000-0000-4000-8000-000000000004', '${EN}', 'm2', '2026-11-02 09:00'),
      ('c0000000-0000-4000-8000-000000000005', '${SOLO}', 'm2', '2026-11-03 09:00');
    insert into blog_comments (id, post_id, user_id, body, removed_at, removed_by, deleted_at, created_at, updated_at) values
      ('d0000000-0000-4000-8000-000000000001', '${IT}', 'm1', 'Ciao', null, null, null, '2026-11-01 10:00', '2026-11-01 10:00'),
      ('d0000000-0000-4000-8000-000000000002', '${ES}', 'm3', 'Spam', '2026-11-02 10:00', 'admin@repget.test', null, '2026-11-01 12:00', '2026-11-02 10:00'),
      ('d0000000-0000-4000-8000-000000000003', '${EN}', 'm2', 'Oops', null, null, '2026-11-03 10:00', '2026-11-01 13:00', '2026-11-03 10:00');
    insert into blog_comment_upvotes (comment_id, user_id) values ('d0000000-0000-4000-8000-000000000001', 'm2');
    insert into credit_ledger (organization_id, type, amount, reference_id, idempotency_key) values ('org1', 'reward', 20, 'm2', 'discover-bonus:m2');
  `);
  return test;
}

/** The engagement part of migration 0093 (between its "-- Nov 13 engagement" and "-- Nov 13 ticket, area \"ads\"" headers): idempotent on its own. */
function engagementStatements(): string[] {
  const file = readFileSync(path.resolve(__dirname, "../../../drizzle/0093_nov13_topups_engagement_ads.sql"), "utf8");
  const start = file.indexOf("-- Nov 13 engagement");
  const end = file.indexOf('-- Nov 13 ticket, area "ads"');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return file
    .slice(start, end)
    .replace(/vector\(\d+\)/g, "text")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function migrate(client: Awaited<ReturnType<typeof seeded>>["client"]) {
  for (const statement of engagementStatements()) await client.exec(statement);
}

describe("the engagement migration", () => {
  // Replaying every migration into PGlite twice is slow on a busy machine.
  it("attaches existing rows to the article's discussion and keeps each member's first upvote", { timeout: 180_000 }, async () => {
    const { client } = await seeded();
    const ledgerBefore = (await client.query(`select * from credit_ledger order by id`)).rows;
    const commentsBefore = (await client.query(`select * from blog_comments order by id`)).rows;
    await migrate(client);

    // Posts made by earlier migrations are originals: their own discussion.
    expect((await client.query(`select 1 from blog_posts where discussion_id <> coalesce(translation_of, id)`)).rows).toHaveLength(0);
    const posts = (await client.query<{ id: string; discussion_id: string }>(`select id, discussion_id from blog_posts where id in ('${EN}', '${IT}', '${ES}', '${SOLO}') order by id`)).rows;
    expect(Object.fromEntries(posts.map((p) => [p.id, p.discussion_id]))).toEqual({ [EN]: EN, [IT]: EN, [ES]: EN, [SOLO]: SOLO });

    const upvotes = (await client.query<{ id: string; user_id: string; discussion_id: string }>(`select id, user_id, discussion_id from blog_post_upvotes order by id`)).rows;
    // m2 had three on the article (ES first, at 09:00 on the 1st): the ES one stays.
    expect(upvotes.map((v) => [v.id.slice(-1), v.user_id, v.discussion_id])).toEqual([
      ["1", "m1", EN],
      ["3", "m2", EN],
      ["5", "m2", SOLO],
    ]);
    const duplicates = (await client.query<{ id: string; post_id: string; kept_upvote_id: string; reason: string; created_at: Date }>(
      `select id, post_id, kept_upvote_id, reason, created_at from blog_post_upvote_duplicates order by id`,
    )).rows;
    expect(duplicates.map((d) => [d.id.slice(-1), d.post_id, d.kept_upvote_id.slice(-1), d.reason])).toEqual([
      ["2", IT, "3", "same_discussion"],
      ["4", EN, "3", "same_discussion"],
    ]);

    // Comments: every one kept as it was, now under the discussion.
    const comments = (await client.query<Record<string, unknown>>(`select * from blog_comments order by id`)).rows;
    const withoutDiscussion = comments.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "discussion_id")));
    expect(withoutDiscussion).toEqual(commentsBefore);
    expect(comments.every((c) => c.discussion_id === EN)).toBe(true);
    expect((await client.query(`select * from blog_comment_upvotes`)).rows).toHaveLength(1);
    // No credits written or changed.
    expect((await client.query(`select * from credit_ledger order by id`)).rows).toEqual(ledgerBefore);
  });

  it("is safe to run twice, and the new keys hold", { timeout: 180_000 }, async () => {
    const { client } = await seeded();
    await migrate(client);
    await migrate(client);
    expect((await client.query(`select * from blog_post_upvotes`)).rows).toHaveLength(3);
    expect((await client.query(`select * from blog_post_upvote_duplicates`)).rows).toHaveLength(2);
    // One per member and discussion: another language's upvote is refused.
    await expect(client.query(`insert into blog_post_upvotes (post_id, discussion_id, user_id) values ('${IT}', '${EN}', 'm1')`)).rejects.toThrow();
    // A translation made after the migration joins the discussion.
    await client.query(`insert into blog_posts (slug, title, category, author, locale, translation_of) values ('leitfaden', 'Leitfaden', 'Guides', 'RepGet team', 'de', '${EN}')`);
    expect((await client.query<{ d: string }>(`select discussion_id as d from blog_posts where slug = 'leitfaden'`)).rows[0].d).toBe(EN);
  });
});
