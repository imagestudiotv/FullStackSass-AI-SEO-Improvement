import { headers } from "next/headers";
import { Suspense } from "react";

import { runPublicAudit } from "@/lib/audit/public-audit";
import { startingOffer } from "@/lib/billing";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam } from "@/lib/tools/i18n/meta";
import { visitorKey } from "@/lib/visitor-key";

import { AuditBand } from "../home-sections";
import { AuditProgress } from "./audit-progress";
import { AuditResult } from "./audit-result";
import { AUDIT_COPY } from "./copy";
import { SitePreviewFallback } from "./site-preview";

export function auditMetadata(locale: Locale) {
  const t = AUDIT_COPY[locale];
  return { title: t.metaTitle, description: t.metaDescription, ...publicPageMetadata("/audit", { locale }) };
}

/**
 * Free public audit — the lead magnet — in any of the five languages
 * (/audit and /[locale]/audit).
 *
 * Shows real findings from a real crawl, then stops. The visitor sees that we
 * found genuine problems on their site, and signing up is how they see the
 * rest and get them fixed. Nothing here is invented: if the crawl fails, the
 * page says so rather than showing a made-up score.
 */
export function AuditPageContent({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const domain = domainParam(searchParams);
  const t = AUDIT_COPY[locale];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      {/*
        The heading shows before a check and while it runs - and gives way to
        the results once they are ready, so a finished audit starts at the top
        of the page instead of below the introduction (client request,
        2026-10-01: the audit is used often, and the result is what they came
        for). See AuditOutcome.
      */}
      {!domain ? <AuditHeading locale={locale} /> : null}

      {/*
        Before a check: the card from the design — the three assets named and
        numbered, the field inside the same pill, the reassurances beneath.

        It is the homepage's own AuditBand rather than a copy of it, in the
        same language. The negative top margin pulls it under the heading
        above, which already supplies the spacing the band assumes it needs.
      */}
      {!domain ? (
        <div className="-mx-4 mt-2">
          <AuditBand t={getMessages(locale).home} href={(path) => localePath(locale, path)} />
        </div>
      ) : null}

      {/*
        Streamed, so the progress screen is the fallback while the crawl runs.
        keyed on the domain so checking a second site remounts the fallback
        rather than leaving the previous result on screen while the new one
        runs.
      */}
      {domain ? (
        <Suspense
          key={domain}
          fallback={
            <>
              <AuditHeading locale={locale} />
              <AuditProgress
                domain={domain}
                copy={t.progress}
                /*
                  The frame shows the address while the crawl runs; the picture
                  comes back with the result, cached alongside it.
                */
                preview={<SitePreviewFallback domain={domain} />}
              />
            </>
          }
        >
          <AuditOutcome domain={domain} locale={locale} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** The page's introduction: before a check, and while one runs. */
function AuditHeading({ locale }: { locale: Locale }) {
  const t = AUDIT_COPY[locale];
  return (
    <div className="text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        {t.titleBefore} <span className="text-primary">{t.titleAccent}</span>
        {t.titleAfter ? ` ${t.titleAfter}` : ""}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">{t.intro}</p>
    </div>
  );
}

/**
 * The crawl itself, isolated so only this part suspends. A finished audit
 * replaces the heading and starts the page; a failed one keeps the heading,
 * with the reason beneath it.
 */
async function AuditOutcome({ domain, locale }: { domain: string; locale: Locale }) {
  // Limits are per visitor, identified only through trusted ingress (lib/visitor-key.ts).
  const visitor = visitorKey(await headers());
  const [outcome, offer] = await Promise.all([runPublicAudit(domain, visitor), startingOffer()]);

  if (!outcome.ok) {
    return (
      <>
        <AuditHeading locale={locale} />
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
          <p className="font-medium">{TOOLS_COMMON[locale].couldNotCheck}</p>
          <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error.message, locale)}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Still the page's one heading, for screen readers and search engines, now naming the site. */}
      <h1 className="sr-only">{AUDIT_COPY[locale].srTitle.replace("{domain}", domain)}</h1>
      <AuditResult result={outcome.result} offer={offer} locale={locale} />
    </>
  );
}
