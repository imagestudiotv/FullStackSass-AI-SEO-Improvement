"use client";

import { ImageIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

type Articles = Messages["home"]["articles"];

/**
 * The sample articles: a list to pick from and a readable preview of the one
 * picked.
 *
 * A tab list, because that is what it is - one panel, several labels that
 * choose what it shows - so a screen reader announces "tab 2 of 3" and the
 * arrow keys move between samples (Home and End jump to the ends). Only the
 * chosen tab is in the Tab order; the panel is focusable so its text can be
 * scrolled and read by keyboard.
 *
 * The first sample renders on the server, so the preview reads without any
 * interaction or JavaScript. Only this slice of the dictionary comes to the
 * browser (see lib/i18n/site-chrome.ts for why never the whole of it).
 */
export function ArticleExamples({ t }: { t: Articles }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const count = t.samples.length;
  const sample = t.samples[active] ?? t.samples[0];

  function select(index: number) {
    const next = (index + count) % count;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, () => void> = {
      ArrowDown: () => select(active + 1),
      ArrowRight: () => select(active + 1),
      ArrowUp: () => select(active - 1),
      ArrowLeft: () => select(active - 1),
      Home: () => select(0),
      End: () => select(count - 1),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      move();
    }
  }

  if (!sample) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-6">
      {/*
        Three across on a phone, showing only the kind of article, so the
        choice sits above the preview in one compact row; a column of full
        cards beside it from lg.
      */}
      <div
        role="tablist"
        aria-label={t.selectorLabel}
        onKeyDown={onKeyDown}
        className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:content-start lg:gap-3"
      >
        {t.samples.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.title}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={`rounded-xl border p-2.5 text-center transition-colors focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none lg:p-4 lg:text-left ${
                selected
                  ? "border-primary/40 bg-primary/[0.05] shadow-sm"
                  : "bg-card hover:border-primary/25 hover:bg-primary/[0.02]"
              }`}
            >
              <span
                className={`block text-xs font-semibold ${selected ? "text-primary-strong" : "text-muted-foreground"}`}
              >
                {item.kind}
              </span>
              <span className="mt-1.5 hidden text-sm leading-snug font-medium text-foreground lg:line-clamp-2">
                {item.title}
              </span>
              <span className="mt-2 hidden text-xs text-muted-foreground lg:block">
                {format(t.readTime, { n: item.minutes })}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${active}`}
        tabIndex={0}
        className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-36px_rgba(0,0,0,0.3)] focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        {/* Page chrome: says what this is before anyone reads it as real. */}
        <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
            {t.sampleLabel}
          </span>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary-strong uppercase">
            {sample.kind} · {format(t.readTime, { n: sample.minutes })}
          </p>
          <h3 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
            {sample.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {sample.description}
          </p>

          {/* Where the generated cover image goes. Decorative. */}
          <div
            aria-hidden="true"
            className="mt-5 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/[0.07] to-info/15 sm:h-28"
          >
            <ImageIcon className="size-6 text-primary/50" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <nav
              aria-label={t.contentsLabel}
              className="rounded-xl border bg-muted/30 p-4 text-sm"
            >
              <p className="font-semibold">{t.contentsLabel}</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground marker:text-primary/70">
                {sample.contents.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ol>
            </nav>

            <div className="min-w-0">
              <h4 className="text-lg font-semibold tracking-tight">
                {sample.heading}
              </h4>
              {sample.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}

              {sample.table ? (
                // Its own horizontal scroll on a narrow phone, never the page's.
                <div className="mt-4 overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[22rem] text-left text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        {sample.table.head.map((cell, index) => (
                          <th
                            key={`${cell}-${index}`}
                            scope="col"
                            className="px-3 py-2 font-semibold"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sample.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, index) =>
                            index === 0 ? (
                              <th
                                key={cell}
                                scope="row"
                                className="px-3 py-2 font-medium"
                              >
                                {cell}
                              </th>
                            ) : (
                              <td
                                key={`${cell}-${index}`}
                                className="px-3 py-2 text-muted-foreground"
                              >
                                {cell}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            {t.sampleNote}
          </p>
        </div>
      </div>
    </div>
  );
}
