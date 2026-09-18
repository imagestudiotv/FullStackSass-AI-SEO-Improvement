"use client";

import { Check, Globe, Loader2, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The "working on it" screen, shown while the crawl runs.
 *
 * Follows the reference the client sent: a browser frame previewing the site
 * on the left, and the deliverables listed on the right, ticking off as the
 * work proceeds. Pressing "check my website" used to change a button label and
 * then sit there for the length of a real crawl with nothing else moving,
 * which reads as a page that has hung.
 *
 * WHAT IS REAL AND WHAT IS NOT. The stages are real stages of the audit in the
 * order they happen, so every label describes work genuinely being done. The
 * TIMING is not measured — a server component cannot stream progress back to a
 * client one — so stages advance on a timer sized to a typical crawl. That is
 * why nothing claims a percentage: a made-up number beside a real label is the
 * part a customer would catch.
 *
 * The page it sits on is a server component doing the actual await, so this
 * unmounts the moment the result arrives, whatever the timer was doing.
 */

/**
 * The three assets, named as the design names them.
 *
 * The detail lines under each are the real stages of our own audit, so the
 * words describe work that is genuinely happening while they are on screen.
 */
const ASSETS = [
  {
    label: "AI SEO Audit",
    lines: [
      "Opening {domain} and mapping the site…",
      "Crawling pages & detecting the platform behind {domain}",
    ],
  },
  {
    label: "Personalized Growth Plan",
    lines: [
      "Scoring titles, headings, images and links",
      "Ordering what to fix by what it is worth",
    ],
  },
  {
    label: "Business Profile + Free Backlink",
    lines: [
      "Checking which AI crawlers are allowed in",
      "Matching you with a business in a related field",
    ],
  },
];

/** Sized to a typical crawl rather than to a promise. */
const STAGE_MS = 2600;

export function AuditProgress({
  domain,
  preview,
}: {
  domain: string;
  /**
   * The framed picture of the site.
   *
   * Passed as a node rather than a URL because fetching it is server work —
   * this component is a client one for its timer, and a client component
   * cannot await. The page renders <SitePreview /> and hands the result down.
   */
  preview: ReactNode;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    /**
     * Stops at the last stage instead of looping. A cycle that restarts tells
     * the visitor the work began again, which is worse than a step that sits
     * there while a slow site finishes responding.
     */
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, ASSETS.length - 1));
    }, STAGE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/*
        The browser frame from the design. The picture inside it is passed in
        rather than fetched here — see SitePreview for why it is the site's
        og:image and not an iframe.
      */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <Globe className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{domain}</span>
          </span>
          <RotateCw
            className="size-3.5 shrink-0 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        {preview}
      </div>

      {/* The assets, ticking off as the work proceeds. */}
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Working on it
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Building your 3 free assets…
        </h2>
        <p className="mt-2 text-muted-foreground">Usually under a minute.</p>

        <ol className="mt-7 space-y-3">
          {ASSETS.map((asset, index) => {
            const done = index < stage;
            const active = index === stage;

            return (
              <li
                key={asset.label}
                className={`rounded-xl border p-4 transition-colors ${
                  active ? "border-primary/40 bg-primary/[0.03]" : ""
                }`}
              >
                <p className="flex items-center gap-2.5">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                      done
                        ? "bg-emerald-500/10 text-emerald-600"
                        : active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground/50"
                    }`}
                  >
                    {done ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : active ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="text-[0.7rem] font-semibold tabular-nums">
                        {index + 1}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      done || active ? "" : "text-muted-foreground/60"
                    }`}
                  >
                    {index + 1}. {asset.label}
                  </span>
                </p>

                {/*
                  The detail lines only while a step is running, as in the
                  reference — a finished step is a tick, and every step showing
                  its full working turns the panel into a wall of text.
                */}
                {active ? (
                  <ul className="mt-3 space-y-1.5 pl-8">
                    {asset.lines.map((line, lineIndex) => (
                      <li
                        key={line}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        {lineIndex === 0 ? (
                          <Sparkles
                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        ) : (
                          <Globe
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {line.replaceAll("{domain}", domain)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/*
          An indeterminate bar, deliberately. It shows that something is
          running without claiming to know how far along it is, which is the
          honest version of a progress bar when the work happens on the server
          and cannot report back.
        */}
        <div
          className="mt-6 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Checking your website"
        >
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
