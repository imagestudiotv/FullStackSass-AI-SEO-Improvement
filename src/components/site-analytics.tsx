"use client";

import { Analytics } from "@vercel/analytics/next";

import { analyticsBeforeSend } from "@/lib/site-analytics";

/**
 * Visit statistics: Vercel Web Analytics, mounted once in the root layout so
 * the public site and the signed-in app are both counted. Cookieless, so no
 * consent banner (the privacy policy says so).
 *
 * A client component only because `beforeSend` is a function, and the root
 * layout is a Server Component, which cannot hand one to the browser.
 *
 * Every address is cleaned before it leaves the browser, and admin pages are
 * not sent at all: see lib/site-analytics.ts.
 *
 * Nothing to configure here, but ORDER MATTERS: enable Web Analytics in the
 * Vercel dashboard (project -> Analytics -> Enable) BEFORE the deploy that
 * first ships this component. Vercel adds the /_vercel/insights/* routes
 * only to deployments built after it is enabled. A deployment built before
 * that answers /_vercel/insights/script.js with a 404, and Chrome logs the
 * failed script on every page, which costs Lighthouse's Best Practices
 * "browser errors logged to the console" audit. Enabling first means no
 * deployment ever carries the error. Enabled late? Redeploy: the old build
 * keeps 404ing until it is replaced.
 *
 * The same 404 appears on any production build served outside Vercel
 * (`next start` on a laptop), so judge that audit on a Vercel deployment.
 * Locally under next dev the package loads Vercel's debug script instead,
 * which logs page views to the console rather than sending them.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={analyticsBeforeSend} />;
}
