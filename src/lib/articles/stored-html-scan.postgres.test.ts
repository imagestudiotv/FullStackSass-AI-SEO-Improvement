import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import { changedHtmlFields, scanStoredHtml } from "../../../scripts/check-stored-html.mjs";

describe("stored HTML inventory", () => {
  it("requires an explicit target and flags FAQ answers without including content", async () => {
    await expect(scanStoredHtml("")).rejects.toThrow("explicitly");
    expect(changedHtmlFields({ body_html: "<p>Safe</p>", faqs: [{ answer: '<img src=x onerror="alert(1)" ">' }] })).toEqual(["faqs[0].answer"]);
  });
});

describe.skipIf(!testPostgresUrl())("read-only inventory on PostgreSQL", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestDb>>;
  beforeAll(async () => { database = await createPostgresTestDb(1); }, 180_000);
  afterAll(async () => { await database?.dispose(); });

  it("reports a stored payload without altering the original row", async () => {
    const payload = '<img src=x onerror="window.__auditProbe=1" ">';
    const [inserted] = await database.sql`
      insert into blog_posts (slug, title, description, category, author, body_html, created_by, updated_by)
      values ('security-scan-fixture', 'Fixture', 'Fixture', 'Guides', 'Test', ${payload}, 'test', 'test') returning id
    `;
    const url = new URL(testPostgresUrl()!);
    url.pathname = `/${database.sql.options.database}`;
    const output: unknown[] = [];
    const result = await scanStoredHtml(url.toString(), (row: unknown) => output.push(row));
    expect(result.changed).toBeGreaterThan(0);
    expect(output).toContainEqual({ table: "blog_posts", id: inserted.id, fields: ["body_html"], result: "review_required" });
    expect(JSON.stringify(output)).not.toContain("__auditProbe");
    const [stored] = await database.sql`select body_html from blog_posts where id=${inserted.id}`;
    expect(stored.body_html).toBe(payload);
  });
});
