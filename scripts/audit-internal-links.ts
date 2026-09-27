/**
 * Dry run: which links in these articles are broken, and what would fix them.
 *
 *   node --env-file=<env file> --import tsx scripts/audit-internal-links.ts \
 *     --website <website id> --article <article id> [--article <id> ...] [--json]
 *
 * WRITES NOTHING. No article, version or cache row is changed, and no post
 * on the customer's site is touched. It reads the articles from the database
 * named by DATABASE_URL and makes read-only GET requests to the customer's
 * own pages (through the same SSRF-safe layer the app uses) to see which
 * links resolve.
 *
 * Both a website and at least one article must be named: this is for
 * looking at specific reported posts, not for sweeping a database.
 *
 * For each problem it prints the application article id, the WordPress post
 * id and public URL when a publish recorded them, the href and anchor text,
 * why it is a problem, and the proposed minimal change (a verified
 * replacement, or removing the link and keeping its words).
 *
 * What the report is NOT: a repair of the live post. The article's stored
 * copy is repaired automatically the next time it is published through the
 * app; a post already live on WordPress stays as it is until someone with
 * authority edits it there (see docs/internal-links.md).
 */
import { auditArticleLinks, type AuditRow } from "@/lib/articles/internal-links";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parse(argv: string[]) {
  let website: string | null = null;
  const articleIds: string[] = [];
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--website") website = argv[++i] ?? null;
    else if (arg === "--article") articleIds.push(argv[++i] ?? "");
    else if (arg === "--json") json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!website || !UUID.test(website)) throw new Error("--website <website id> is required");
  if (articleIds.length === 0) throw new Error("name at least one --article <article id>");
  const bad = articleIds.filter((id) => !UUID.test(id));
  if (bad.length > 0) throw new Error(`Not an article id: ${bad.join(", ")}`);
  return { website, articleIds, json };
}

function print(rows: AuditRow[], requested: string[]) {
  const found = new Set(rows.map((row) => row.articleId));
  for (const id of requested.filter((id) => !found.has(id))) {
    console.log(`\n## ${id}: not found on this website`);
  }
  for (const row of rows) {
    console.log(`\n## ${row.title}`);
    console.log(`   article ${row.articleId} (${row.status})`);
    console.log(`   post    ${row.remotePostId ?? "no post id recorded"}  ${row.publicUrl ?? ""}`);
    if (row.findings.length === 0) {
      console.log("   no link problems found");
      continue;
    }
    for (const finding of row.findings) {
      console.log(`\n   - ${finding.outcome.toUpperCase()}  href="${finding.href}"  text="${finding.text}"`);
      console.log(`     reason:  ${finding.reason}${finding.verdict ? ` [${finding.verdict}]` : ""}`);
      if (finding.url && finding.url !== finding.href) console.log(`     checked: ${finding.url}`);
      if (finding.replacement) console.log(`     proposed href: ${finding.replacement}`);
      console.log(`     before:  ${finding.before}`);
      console.log(`     after:   ${finding.after}`);
    }
  }
  const problems = rows.reduce((sum, row) => sum + row.findings.filter((f) => f.outcome !== "unverified").length, 0);
  const uncertain = rows.reduce((sum, row) => sum + row.findings.filter((f) => f.outcome === "unverified").length, 0);
  console.log(`\n${problems} problem(s) with a proposed change; ${uncertain} link(s) could not be checked and would be kept. Nothing was changed.`);
}

async function main() {
  let args: ReturnType<typeof parse>;
  try {
    args = parse(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Pass the environment explicitly, e.g. node --env-file=<file> ...");
    process.exit(2);
  }
  const rows = await auditArticleLinks(args.website, args.articleIds, { budgetMs: 60_000 });
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else print(rows, args.articleIds);
  process.exit(0);
}

main().catch((error) => {
  console.error("Audit failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
