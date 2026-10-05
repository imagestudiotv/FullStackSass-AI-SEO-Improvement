/** Read-only inventory. Never loads .env.local or rewrites stored content. */
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { sanitizeHtml } from "../src/lib/articles/sanitize.ts";

export function changedHtmlFields(row) {
  const fields = [];
  if (typeof row.body_html === "string" && sanitizeHtml(row.body_html) !== row.body_html.trim()) fields.push("body_html");
  if (Array.isArray(row.faqs)) {
    row.faqs.forEach((faq, index) => {
      if (typeof faq?.answer === "string" && sanitizeHtml(faq.answer) !== faq.answer.trim()) fields.push(`faqs[${index}].answer`);
    });
  }
  return fields;
}

export async function scanStoredHtml(url, report = (item) => console.log(JSON.stringify(item))) {
  if (!url) throw new Error("Set SCAN_HTML_DATABASE_URL explicitly; no database has been contacted.");
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
  let scanned = 0;
  let changed = 0;
  try {
    // Server-enforced read-only, consistent snapshot. No UPDATE mode exists.
    await client.begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local statement_timeout = '15s'`;
      for (const table of ["articles", "article_versions", "blog_posts"]) {
        let after = "";
        for (;;) {
          const columns = table === "blog_posts" ? tx`id, body_html, faqs` : tx`id, body_html`;
          const batch = await tx`select ${columns} from ${tx(table)} where id::text > ${after} order by id::text limit 100`;
          for (const row of batch) {
            scanned++;
            const fields = changedHtmlFields(row);
            if (fields.length) {
              changed++;
              // IDs only: no bodies, customer names, URLs, secrets or snippets.
              report({ table, id: row.id, fields, result: "review_required" });
            }
          }
          if (batch.length < 100) break;
          after = batch.at(-1).id;
        }
      }
    });
    report({ scanned, changed, readOnly: true, note: "Changes include harmless normalization; this is not a confirmed-XSS count." });
    return { scanned, changed };
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanStoredHtml(process.env.SCAN_HTML_DATABASE_URL).catch(() => {
    console.error("Stored HTML scan failed. Check SCAN_HTML_DATABASE_URL, read permissions and migration level. No content was modified.");
    process.exitCode = 1;
  });
}
