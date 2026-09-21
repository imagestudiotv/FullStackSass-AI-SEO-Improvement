import { NextResponse } from "next/server";

import { CrawlError, fetchHomepage } from "@/lib/websites/crawl";
import { isPublicWebsiteUrl } from "@/lib/websites/url";

/**
 * TEMPORARY DIAGNOSTIC — how the real crawler behaves FROM VERCEL.
 *
 * Every crawl measurement in this project so far was taken from a laptop on a
 * residential Taiwanese ISP. Production runs from AWS ranges in iad1, and bot
 * management scores datacentre addresses very differently: the browser-header
 * retry that rescues hermes.com locally may well be refused there, because it
 * is fighting IP reputation rather than header shape.
 *
 * Two diagnoses here have already been wrong because a local result was
 * assumed to hold in production. This measures it instead of inferring it.
 *
 * Calls fetchHomepage, not a bare fetch, so what is measured is the real
 * onboarding path: the identified crawler, its browser-header retry, and the
 * redirect handling.
 *
 * GATED. An endpoint that fetches a URL on request is the shape of an SSRF
 * hole; the key check and the fixed target list keep it from being one — no
 * caller-supplied URL is accepted at all.
 *
 * DELETE ONCE THE ANSWER IS RECORDED.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Fixed list. Nothing here is caller-controlled. */
const TARGETS = [
  "https://imagestudio.com",
  "https://babylovegrowth.ai",
  "https://wordpress.org",
  "https://stripe.com",
  "https://vercel.com",
  "https://ghost.org",
  "https://squarespace.com",
  "https://www.nike.com",
  "https://hermes.com",
  "https://rolex.com",
  "https://www.gucci.com",
];

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("k");
  if (!key || key !== process.env.BETTER_AUTH_SECRET?.slice(0, 16)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const results = await Promise.all(
    TARGETS.map(async (target) => {
      const startedAt = Date.now();
      try {
        const page = await fetchHomepage(target, isPublicWebsiteUrl);
        return {
          target,
          ok: true,
          status: page.statusCode,
          bytes: page.htmlBytes,
          title: page.title?.slice(0, 55) ?? null,
          ms: Date.now() - startedAt,
        };
      } catch (error) {
        const crawl = error as CrawlError;
        return {
          target,
          ok: false,
          kind: crawl.kind ?? "unknown",
          status: crawl.status ?? null,
          ms: Date.now() - startedAt,
        };
      }
    }),
  );

  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    ok: results.filter((r) => r.ok).length,
    total: results.length,
    results,
  });
}
