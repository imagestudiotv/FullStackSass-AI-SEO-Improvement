"use server";

import { headers } from "next/headers";

import { issueText } from "@/app/(site)/(app)/websites/[websiteId]/health-model";
import { runPublicAudit } from "@/lib/audit/public-audit";
import { ISSUE_LABELS } from "@/lib/audit/rules";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { visitorKey } from "@/lib/visitor-key";
import { publicSitePreview } from "@/lib/websites/public-preview";
import type { SiteCard } from "@/lib/websites/site-card";

/**
 * What the homepage field and the growth plan page (growth-plan-flow.tsx) ask
 * the server, as an anonymous visitor. Both are the free tools' guarded work
 * (lib/tools/public-guard.ts): the limits apply per visitor, identified only
 * through trusted ingress (lib/visitor-key.ts). No model is called: every
 * answer is read from the visitor's own website.
 */

/** Longer than any address anyone types; anything beyond is not an address. */
const MAX_INPUT = 300;

/** The typed site's name, a line about it and its icon, or null (lib/websites/public-preview.ts). */
export async function suggestSite(input: string): Promise<SiteCard | null> {
  if (typeof input !== "string" || input.length > MAX_INPUT) return null;
  return publicSitePreview(input, visitorKey(await headers()));
}

export type PlanIssue = { label: string; severity: "critical" | "warning" | "info"; pageCount: number };

export type PlanAudit =
  | {
      ok: true;
      score: number;
      pagesChecked: number;
      counts: { critical: number; warning: number; info: number };
      /** The most serious first, in the visitor's language. */
      issues: PlanIssue[];
      /** Findings beyond the ones listed. */
      hiddenIssues: number;
      /** The AI crawlers robots.txt shuts out, by owner ("OpenAI", "Anthropic"...). */
      blockedCrawlers: string[];
      crawlersChecked: number;
      siteName: string | null;
      language: string | null;
      platform: string | null;
    }
  | { ok: false; message: string };

/**
 * The free audit (lib/audit/public-audit.ts, the same crawl and cache as
 * /audit) in the shape the growth plan shows. A refusal or an unreachable
 * site comes back as a message to show, never a throw: the plan goes on
 * without it.
 */
export async function auditForPlan(domain: string, rawLocale: string): Promise<PlanAudit> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  if (typeof domain !== "string" || domain.length > MAX_INPUT) return { ok: false, message: localizeToolMessage("Enter a valid website address", locale) };
  const outcome = await runPublicAudit(domain, visitorKey(await headers()));
  if (!outcome.ok) return { ok: false, message: localizeToolMessage(outcome.error.message, locale) };

  const result = outcome.result;
  const health = locale === "en" ? null : getMessages(locale).app.health;
  const label = (type: string) => (health ? issueText(type, health).label : (ISSUE_LABELS[type] ?? type));
  return {
    ok: true,
    score: result.score,
    pagesChecked: result.pagesChecked,
    counts: result.counts,
    issues: result.issues.slice(0, 4).map((issue) => ({ label: label(issue.type), severity: issue.severity, pageCount: issue.pageCount })),
    hiddenIssues: result.hiddenIssues + Math.max(0, result.issues.length - 4),
    blockedCrawlers: [...new Set(result.crawlers.filter((crawler) => !crawler.allowed).map((crawler) => crawler.owner))],
    crawlersChecked: result.crawlers.length,
    siteName: result.siteName,
    language: result.language,
    platform: result.platform,
  };
}
