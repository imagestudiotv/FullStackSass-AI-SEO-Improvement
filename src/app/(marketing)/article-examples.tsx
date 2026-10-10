"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { RealArticle } from "@/lib/marketing/real-articles";

type Articles = Messages["home"]["articles"];

/**
 * Three real, published articles: a list to pick from and a readable preview
 * of the one picked - its picture, its contents and the opening of its first
 * section - with a link to the whole article (client, 2026-10-09). The
 * articles are lib/marketing/real-articles.ts; the words around them are the
 * dictionary's.
 *
 * A tab list, because that is what it is - one panel, several labels that
 * choose what it shows - so a screen reader announces "tab 2 of 3" and the
 * arrow keys move between articles (Home and End jump to the ends). Only the
 * chosen tab is in the Tab order; the panel is focusable so its text can be
 * scrolled and read by keyboard.
 *
 * The first article renders on the server, so the preview reads without any
 * interaction or JavaScript. Only this slice of the dictionary comes to the
 * browser (see lib/i18n/site-chrome.ts for why never the whole of it).
 */
export function ArticleExamples({ t, articles }: { t: Articles; articles: RealArticle[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const count = articles.length;
  const article = articles[active] ?? articles[0];

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

  if (!article) return null;
  const external = /^https?:\/\//.test(article.href);
  const readFull = (
    <>
      {t.readFull}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </>
  );

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
        {articles.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.href}
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
                {t.kinds[item.kind]}
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
        {/* Page chrome: where the article is published. */}
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
          <span className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
            {article.address}
          </span>
          <span className="hidden shrink-0 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success sm:inline">
            {t.realLabel}
          </span>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary-strong uppercase">
            {t.kinds[article.kind]} · {format(t.readTime, { n: article.minutes })}
          </p>
          <h3 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
            {article.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {article.description}
          </p>

          {/*
            The article's own picture. A diagram is shown whole on white; a
            photograph fills the frame. Below the fold, so it loads lazily.
          */}
          <div className="mt-5 overflow-hidden rounded-xl border bg-white">
            <Image
              key={article.image.src}
              src={article.image.src}
              alt={article.image.alt}
              width={article.image.width}
              height={article.image.height}
              sizes="(min-width: 1152px) 760px, (min-width: 1024px) 60vw, 92vw"
              className={`aspect-video w-full ${article.image.fit === "cover" ? "object-cover" : "object-contain"}`}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <nav
              aria-label={t.contentsLabel}
              className="rounded-xl border bg-muted/30 p-4 text-sm"
            >
              <p className="font-semibold">{t.contentsLabel}</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground marker:text-primary/70">
                {article.contents.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ol>
            </nav>

            <div className="min-w-0">
              <h4 className="text-lg font-semibold tracking-tight">
                {article.heading}
              </h4>
              {article.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              <p className="mt-4">
                {external ? (
                  <a
                    href={article.href}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
                  >
                    {readFull}
                  </a>
                ) : (
                  <Link
                    href={article.href}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
                  >
                    {readFull}
                  </Link>
                )}
              </p>
            </div>
          </div>

          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            {t.realNote}
          </p>
        </div>
      </div>
    </div>
  );
}
