import { Suspense } from "react";

import { runPublicAudit } from "@/lib/audit/public-audit";
import { startingOffer } from "@/lib/billing";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { AuditBand } from "../home-sections";
import { AuditProgress } from "./audit-progress";
import { SitePreviewFallback } from "./site-preview";
import { AuditResult } from "./audit-result";

export const metadata = {
  title: "Free website check",
  description:
    "See what is holding your website back on Google and whether AI assistants can read your site. No account needed.",
  ...publicPageMetadata("/audit"),
};

// Crawls a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * Free public audit — the lead magnet.
 *
 * Shows real findings from a real crawl, then stops. The visitor sees that we
 * found genuine problems on their site, and signing up is how they see the
 * rest and get them fixed. Nothing here is invented: if the crawl fails, the
 * page says so rather than showing a made-up score.
 */
export default async function AuditPage({
  searchParams,
}: PageProps<"/audit">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      {/*
        The heading shows before a check and while it runs - and gives way to
        the results once they are ready, so a finished audit starts at the top
        of the page instead of below the introduction (client request,
        2026-10-01: the audit is used often, and the result is what they came
        for). See AuditOutcome.
      */}
      {!domain ? <AuditHeading /> : null}

      {/*
        Before a check: the card from the design — the three assets named and
        numbered, the field inside the same pill, the reassurances beneath.

        It is the homepage's own AuditBand rather than a copy of it. The two
        are the same drawing, and a second implementation of a card this
        central is the kind of pair that drifts the first time one is retouched.
        The negative top margin pulls it under the heading above, which already
        supplies the spacing the band assumes it needs.
      */}
      {!domain ? (
        <div className="-mx-4 mt-2">
          <AuditBand t={getMessages("en").home} href={(path) => path} />
        </div>
      ) : null}

      {/*
        Streamed, so the progress screen is the fallback while the crawl runs.

        The audit await used to sit in this component, which meant the whole
        page waited on it: the visitor pressed the button, the button label
        changed, and then nothing moved for the length of a real crawl. Moving
        the await into its own component lets everything above render
        immediately and the progress screen show underneath it.

        keyed on the domain so checking a second site remounts the fallback
        rather than leaving the previous result on screen while the new one
        runs.
      */}
      {domain ? (
        <Suspense
          key={domain}
          fallback={
            <>
              <AuditHeading />
              <AuditProgress
                domain={domain}
                /*
                  The frame shows the address while the crawl runs. The picture
                  is NOT fetched here — it used to be, and it raced the audit: a
                  cached result returns in milliseconds while the image still
                  needs a second or two, so the screen unmounted before it
                  arrived and the frame only ever showed this fallback. It comes
                  back with the result now, cached alongside it.
                */
                preview={<SitePreviewFallback domain={domain} />}
              />
            </>
          }
        >
          <AuditOutcome domain={domain} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** The page's introduction: before a check, and while one runs. */
function AuditHeading() {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Free website check
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        Your free <span className="text-primary">growth plan</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
        Enter your website and we will read your pages, score them, and show
        you what is holding you back on Google - and whether AI assistants can
        read your site at all.
      </p>
    </div>
  );
}

/**
 * The crawl itself, isolated so only this part suspends. A finished audit
 * replaces the heading and starts the page; a failed one keeps the heading,
 * with the reason beneath it.
 */
async function AuditOutcome({ domain }: { domain: string }) {
  const [outcome, offer] = await Promise.all([runPublicAudit(domain), startingOffer()]);

  if (!outcome.ok) {
    return (
      <>
        <AuditHeading />
        <div
          className="mx-auto mt-8 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">We could not check that website</p>
          <p className="mt-1 text-muted-foreground">{outcome.error.message}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Still the page's one heading, for screen readers and search engines, now naming the site. */}
      <h1 className="sr-only">Your free growth plan for {domain}</h1>
      <AuditResult result={outcome.result} offer={offer} />
    </>
  );
}
