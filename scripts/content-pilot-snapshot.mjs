import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import nextEnv from "@next/env";
import postgres from "postgres";

// Explicit, read-only export of ONE scheduled brief. No credentials, accounts,
// integration records, publication events, quota consumption or calendar edits.
const [websiteId, calendarItemId, caseId] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(websiteId ?? "") || !uuid.test(calendarItemId ?? "") ||
    !/^customer-[a-z0-9-]{1,70}$/.test(caseId ?? "")) {
  throw new Error("Usage: node scripts/content-pilot-snapshot.mjs WEBSITE_UUID CALENDAR_UUID customer-CASE");
}
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the read-only snapshot.");
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15, idle_timeout: 5, prepare: false });
try {
  const snapshot = await sql.begin("read only", async tx => {
    const [row] = await tx`
      select w.brand_name, w.industry, w.country, w.language,
        w.description, w.target_audience, w.services, w.article_style,
        w.target_word_count, w.internal_link_target, w.table_of_contents,
        w.author_perspective, w.mention_similar_products, w.comparison_table,
        w.faq_section, w.image_style, w.image_brief, w.image_instructions,
        v.article_instructions, v.tone, v.avoid, v.vocabulary, v.usps, v.facts, v.social_links,
        c.title, c.target_keyword, c.custom_instructions,
        k.intent, k.cluster_id
      from websites w
      join calendar_items c on c.website_id = w.id and c.id = ${calendarItemId}
      left join brand_voice v on v.website_id = w.id
      left join keywords k on k.website_id = w.id and k.term = c.target_keyword
      where w.id = ${websiteId} and c.status = 'planned' limit 1`;
    if (!row) throw new Error("No planned calendar item belonging to the selected website.");
    const data = Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase()), value]));
    const { clusterId, ...brief } = data;
    const siblings = clusterId ? await tx`
      select term from keywords where website_id = ${websiteId}
        and cluster_id = ${clusterId} and term <> ${brief.targetKeyword}
      order by term limit 8` : [];
    for (const key of ["services", "usps", "facts"]) {
      brief[key] = Array.isArray(brief[key]) ? brief[key].filter(value => typeof value === "string") : [];
    }
    brief.socialLinks = Array.isArray(brief.socialLinks) ? brief.socialLinks.filter(value =>
      value && typeof value.platform === "string" && typeof value.url === "string") : [];
    brief.targetKeyword ||= brief.title;
    brief.relatedKeywords = siblings.map(row => row.term);
    brief.backlink = null; // Never reserve or consume a real partner placement for a pilot.
    const roll = createHash("sha256").update(`tables:${calendarItemId}`).digest().readUInt16BE(0) / 0x10000;
    const wanted = roll < 0.45 ? 1 : roll < 0.8 ? 2 : 3;
    brief.tableCount = brief.targetWordCount !== null && brief.targetWordCount < 1000 ? 1 :
      brief.targetWordCount !== null && brief.targetWordCount < 1600 ? Math.min(wanted, 2) : wanted;
    return { version: 1, caseId, websiteId, calendarItemId,
      capturedAt: new Date().toISOString(), brief };
  });
  const directory = path.resolve("test-results/content-pilot/customer-inputs");
  mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `${caseId}.json`);
  writeFileSync(filename, JSON.stringify(snapshot, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ snapshot: filename, caseId, readOnly: true }));
} catch (error) {
  // Database/provider errors can include connection strings or customer inputs.
  console.error(`Snapshot failed (${error.code || error.name}). No production changes were made.`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
