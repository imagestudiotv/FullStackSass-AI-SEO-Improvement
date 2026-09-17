"use client";

import { Check, Globe, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The "working on it" screen, shown while the crawl runs.
 *
 * The client asked for this: pressing "check my website" used to change a
 * button label and then sit there for the length of a real crawl — several
 * seconds, sometimes more on a slow site — with nothing else moving. That
 * reads as a page that has hung, and people click again.
 *
 * WHAT IT IS AND IS NOT: the steps are real stages of the audit in the order
 * they actually happen, so the labels describe work that is genuinely being
 * done. The TIMING is not measured — a server component cannot stream
 * progress back to a client one — so the stages advance on a timer sized to a
 * typical crawl. That is why nothing here claims a percentage: a made-up
 * number beside a real label is the part a customer would catch.
 *
 * The page it sits on is a server component doing the actual await, so this
 * unmounts the moment the result arrives, whatever the timer was doing.
 */

const STAGES = [
  {
    icon: Globe,
    label: "Opening your website",
    detail: "Following redirects and reading the homepage.",
  },
  {
    icon: Sparkles,
    label: "Mapping your pages",
    detail: "Up to five of them, the way a search engine would.",
  },
  {
    icon: Check,
    label: "Scoring what we found",
    detail: "Titles, headings, images, links and AI crawler access.",
  },
];

/** Sized to a typical crawl rather than to a promise. */
const STAGE_MS = 2600;

export function AuditProgress({ domain }: { domain: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    /**
     * Stops at the last stage instead of looping. A cycle that restarts tells
     * the visitor the work began again, which is worse than a step that sits
     * there while a slow site finishes responding.
     */
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, STAGE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto mt-14 max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Working on it
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">
        Checking {domain}…
      </h2>
      <p className="mt-2 text-muted-foreground">Usually under a minute.</p>

      <ol className="mt-8 space-y-3">
        {STAGES.map((item, index) => {
          const done = index < stage;
          const active = index === stage;
          const Icon = item.icon;

          return (
            <li
              key={item.label}
              className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                active ? "border-primary/40 bg-primary/[0.03]" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
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
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="size-3.5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-medium ${
                    done || active ? "" : "text-muted-foreground/60"
                  }`}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {item.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {/*
        An indeterminate bar, deliberately. It shows that something is running
        without claiming to know how far along it is, which is the honest
        version of a progress bar when the work happens on the server and
        cannot report back.
      */}
      <div
        className="mt-6 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Checking your website"
      >
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}
