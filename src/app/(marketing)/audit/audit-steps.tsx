"use client";

import { Check, ChevronDown, Globe, Layers, Languages } from "lucide-react";
import { useState } from "react";

import type { PublicAuditResult } from "@/lib/audit/public-audit";

/**
 * The three assets, kept after the check finishes.
 *
 * The loading screen showed them building and then vanished, so the work it
 * described disappeared the moment it produced anything. These are the same
 * three rows, still expandable, now holding what each one actually found —
 * the visitor watched us build three things and can look at all three.
 *
 * Everything shown is read from the result. Nothing here re-derives or
 * estimates: a step with nothing to report says so rather than inventing a
 * summary to fill its panel.
 */

function Row({
  index,
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  index: number;
  label: string;
  /** One line visible while collapsed — the answer, not a restatement. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {index}. {label}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? <div className="border-t px-4 py-4">{children}</div> : null}
    </li>
  );
}

export function AuditSteps({ result }: { result: PublicAuditResult }) {
  /**
   * Nothing open to begin with. The findings are below this panel in full, so
   * an expanded row on arrival would push them down the page to repeat
   * something the visitor can already see.
   */
  const [open, setOpen] = useState<number | null>(null);

  const blocked = result.crawlers.filter((crawler) => !crawler.allowed);
  const allowed = result.crawlers.length - blocked.length;
  const totalIssues =
    result.counts.critical + result.counts.warning + result.counts.info;

  function toggle(index: number) {
    setOpen((current) => (current === index ? null : index));
  }

  return (
    <div className="mt-12">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Your 3 free assets
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        Done. Here is what each one found.
      </h2>

      <ul className="mt-5 space-y-3">
        <Row
          index={1}
          label="AI SEO Audit"
          summary={`${result.pagesChecked} ${
            result.pagesChecked === 1 ? "page" : "pages"
          } read${result.platform ? ` · ${result.platform}` : ""}`}
          open={open === 0}
          onToggle={() => toggle(0)}
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Globe,
                term: "Pages read",
                value: String(result.pagesChecked),
                note: "Free checks read up to five.",
              },
              {
                icon: Layers,
                term: "Platform",
                value: result.platform ?? "Custom",
                note: result.platform
                  ? "Detected from the markup."
                  : "No common platform recognised.",
              },
              {
                icon: Languages,
                term: "Language",
                value: result.language?.toUpperCase() ?? "Not set",
                note: result.language
                  ? "What the page declares."
                  : "No lang attribute — engines have to guess.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.term}>
                  <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {item.term}
                  </dt>
                  <dd className="mt-1.5 font-semibold">{item.value}</dd>
                  <dd className="text-xs text-muted-foreground">{item.note}</dd>
                </div>
              );
            })}
          </dl>
        </Row>

        <Row
          index={2}
          label="Personalized Growth Plan"
          summary={
            totalIssues === 0
              ? "Nothing wrong on the pages we read"
              : `${totalIssues} ${
                  totalIssues === 1 ? "thing" : "things"
                } to fix · scored ${result.score} of 100`
          }
          open={open === 1}
          onToggle={() => toggle(1)}
        >
          {totalIssues === 0 ? (
            <p className="text-sm text-muted-foreground">
              We found nothing wrong on the pages we read, which is rarer than
              it sounds.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                In the order worth doing them. The full list is below, each
                with what to change.
              </p>
              <ul className="mt-3 space-y-2">
                {result.issues.slice(0, 3).map((issue, position) => (
                  <li
                    key={issue.type}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.7rem] font-semibold tabular-nums">
                      {position + 1}
                    </span>
                    <span className="min-w-0">
                      {issue.detail}
                      <span className="text-muted-foreground">
                        {" "}
                        · {issue.pageCount}{" "}
                        {issue.pageCount === 1 ? "page" : "pages"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {result.hiddenIssues > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {result.hiddenIssues} more you get when you join.
                </p>
              ) : null}
            </>
          )}
        </Row>

        <Row
          index={3}
          label="Business Profile + Free Backlink"
          summary={
            blocked.length === 0
              ? `Every AI assistant can read you · ${allowed}/${result.crawlers.length}`
              : `${blocked.length} AI ${
                  blocked.length === 1 ? "assistant is" : "assistants are"
                } blocked`
          }
          open={open === 2}
          onToggle={() => toggle(2)}
        >
          <p className="text-sm text-muted-foreground">
            {blocked.length === 0
              ? "Your robots.txt lets every major AI crawler through, so you can be cited in their answers."
              : `Your robots.txt blocks ${blocked.length} of them. They cannot cite a site they are not allowed to read.`}
          </p>

          {/*
            The backlink is what joining gives, not what the check produced.
            Said plainly here rather than implied by the step's name, which
            comes from the design.
          */}
          <p className="mt-3 text-sm text-muted-foreground">
            Your profile and first backlink are set up when you join — we match
            you with a business in a related field and your article carries a
            link back to your site.
          </p>

          {result.linkedHosts.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Sites you already link out to
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.linkedHosts.map((host) => (
                  <span
                    key={host}
                    className="rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground"
                  >
                    {host}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Row>
      </ul>
    </div>
  );
}
