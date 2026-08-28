/**
 * Seeds the plans table. Idempotent — matches on name, so it is safe to re-run
 * and will be needed again for the production database.
 * stripePriceId stays null until Stripe products exist (Day 3).
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

const PLANS = [
  { name: "Starter",  priceCents:   100, articleLimit:  1, keywordLimit:   10, siteLimit:  1, monthlyCredits:  1 },
  { name: "Basic",    priceCents:  9900, articleLimit: 10, keywordLimit:  100, siteLimit:  1, monthlyCredits: 10 },
  { name: "Pro",      priceCents: 18900, articleLimit: 25, keywordLimit:  300, siteLimit:  3, monthlyCredits: 25 },
  { name: "Advanced", priceCents: 26900, articleLimit: 50, keywordLimit: 1000, siteLimit: 10, monthlyCredits: 50 },
];

for (const p of PLANS) {
  const existing = await sql`select id from plans where name = ${p.name}`;
  if (existing.length) {
    await sql`update plans set
      price_cents=${p.priceCents}, article_limit=${p.articleLimit},
      keyword_limit=${p.keywordLimit}, site_limit=${p.siteLimit},
      monthly_credits=${p.monthlyCredits}, is_active=true, updated_at=now()
      where id=${existing[0].id}`;
    console.log(`updated ${p.name}`);
  } else {
    await sql`insert into plans
      (name, price_cents, article_limit, keyword_limit, site_limit, monthly_credits)
      values (${p.name}, ${p.priceCents}, ${p.articleLimit}, ${p.keywordLimit}, ${p.siteLimit}, ${p.monthlyCredits})`;
    console.log(`inserted ${p.name}`);
  }
}

const rows = await sql`select name, price_cents, article_limit, keyword_limit, site_limit, monthly_credits, stripe_price_id, is_active from plans order by price_cents`;
console.table(rows.map(r => ({ ...r })));
await sql.end();
