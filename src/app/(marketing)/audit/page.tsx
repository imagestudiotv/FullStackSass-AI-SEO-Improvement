import { Suspense } from "react";

import { runPublicAudit } from "@/lib/audit/public-audit";
import { getMessages } from "@/lib/i18n/messages";
import { AuditBand } from "../home-sections";
import { AuditForm } from "./audit-form";
import { AuditProgress } from "./audit-progress";
import { SitePreviewFallback } from "./site-preview";
import { AuditResult } from "./audit-result";

export const metadata = {
  title: "Free website check",
  description:
    "See what is holding your website back on Google and whether AI assistants can read your site. No account needed.",
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
      <div className="text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Free website check
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Your free <span className="text-primary">growth plan</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
          Enter your website and we will read your pages, score them, and show
          you what is holding you back on Google — and whether AI assistants can
          read your site at all.
        </p>
      </div>

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
        After a check: the plain field. The full card here would put a
        conversion block between the heading and the result the visitor is
        waiting on, pushing the answer below the fold on the one screen where
        it is the entire point.
      */}
      {domain ? (
        <div className="mx-auto mt-8 max-w-xl">
          <AuditForm key={domain} defaultValue={domain} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            No account, no card. Takes about a minute.
          </p>
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
          }
        >
          <AuditOutcome domain={domain} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** The crawl itself, isolated so only this part suspends. */
async function AuditOutcome({ domain }: { domain: string }) {
  const outcome = await runPublicAudit(domain);

  if (!outcome.ok) {
    return (
      <div
        className="mx-auto mt-8 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        role="alert"
      >
        <p className="font-medium">We could not check that website</p>
        <p className="mt-1 text-muted-foreground">{outcome.error.message}</p>
      </div>
    );
  }

  return <AuditResult result={outcome.result} />;
}
