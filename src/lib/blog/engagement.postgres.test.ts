import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { blogPosts, blogPostUpvotes } from "@/lib/db/schema";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * One upvote per member and discussion (Nov 13 engagement) under real
 * concurrency: two requests on separate connections - on the English and the
 * Italian version of one article, at the same moment - make one upvote. The
 * second waits for the first's transaction and then finds its row
 * (lib/blog/engagement.ts setPostUpvote inserts with ON CONFLICT DO NOTHING).
 */

describe.skipIf(!testPostgresUrl())("cross-language upvotes on independent PostgreSQL connections", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestDb>>;
  beforeAll(async () => {
    database = await createPostgresTestDb(2, { prefix: "nov13_engagement_test" });
  }, 600_000); // Replays every migration over a real connection: minutes on a busy machine.
  afterAll(async () => {
    await database?.dispose();
  });

  it("makes one upvote of two simultaneous presses on two language versions", async () => {
    const [one, two] = database.dbs;
    const [en] = await one
      .insert(blogPosts)
      .values({ slug: `race-${randomUUID().slice(0, 6)}`, title: "Race", category: "Guides", author: "RepGet team", status: "published" })
      .returning();
    const [it] = await one
      .insert(blogPosts)
      .values({ slug: `gara-${randomUUID().slice(0, 6)}`, title: "Gara", category: "Guides", author: "RepGet team", status: "published", locale: "it", translationOf: en.id })
      .returning();
    expect(it.discussionId).toBe(en.id);
    const member = `u_${randomUUID().slice(0, 8)}`;
    await one.insert(user).values({ id: member, name: "Racer", email: `${member}@example.test` });

    for (let trial = 0; trial < 3; trial++) {
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      // The first request's insert is made and not yet committed when the second one arrives.
      const first = one.transaction(async (tx) => {
        const rows = await tx.insert(blogPostUpvotes).values({ postId: en.id, discussionId: en.discussionId, userId: member }).onConflictDoNothing().returning();
        await held;
        return rows.length;
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = two.insert(blogPostUpvotes).values({ postId: it.id, discussionId: it.discussionId, userId: member }).onConflictDoNothing().returning();
      await new Promise((resolve) => setTimeout(resolve, 100));
      release();
      const [made, alsoMade] = await Promise.all([first, second.then((rows) => rows.length)]);
      expect(made + alsoMade).toBe(1);
      const rows = await one.select().from(blogPostUpvotes).where(and(eq(blogPostUpvotes.discussionId, en.id), eq(blogPostUpvotes.userId, member)));
      expect(rows).toHaveLength(1);
      await one.delete(blogPostUpvotes).where(eq(blogPostUpvotes.discussionId, en.id));
    }
  });
});
