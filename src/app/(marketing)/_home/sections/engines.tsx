import type { ReactNode } from "react";

import type { Locale } from "@/lib/i18n/config";
import { storyCopy } from "@/lib/i18n/home/story";

import type { SectionProps } from "../types";

import styles from "./engines.module.css";

/** Maps the design's class names to this module's, so the markup reads like the design. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/** How many posts each weekday of the drawn calendar holds: a shape, not a schedule. */
const SLOTS = [3, 2, 3, 2, 3];

/** MON to FRI in the visitor's language (5 January 2026 was a Monday), as the design writes them. */
function weekdays(locale: Locale): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return SLOTS.map((_, i) =>
    format
      .format(new Date(Date.UTC(2026, 0, 5 + i)))
      .replace(/\.$/, "")
      .toLocaleUpperCase(locale),
  );
}

/**
 * "One platform. Four growth engines." - the dark band of four tilted cards,
 * ported from the client's approved design (design.html, section
 * `rgx-growth-four`, 2026-11-04).
 *
 * The drawings are pure CSS. The section carries `data-reveal`: the page's
 * RevealRoot (one IntersectionObserver for the page) marks it `data-shown`
 * once it scrolls in, which is the design's `is-visible` - it draws the trend
 * line and the link network and starts the "Ready to publish" note floating.
 * With reduced motion nothing moves and the drawings are shown complete.
 *
 * The drawings illustrate what each engine does; they carry no results.
 */
export function Engines({ locale }: SectionProps) {
  const e = storyCopy(locale).engines;
  const days = weekdays(locale);

  return (
    <section id="growth-engines" className={c("rgx-growth-four")} aria-labelledby="rgx-growth-four-heading" data-reveal>
      <div className={c("rgx-growth-four-inner")}>
        <header className={c("rgx-growth-four-heading")}>
          <div>
            <span className={c("eyebrow")}>{e.eyebrow}</span>
            <h2 id="rgx-growth-four-heading">
              {e.titleStart} <em>{e.titleAccent}</em>
            </h2>
          </div>
          <p>{e.sub}</p>
        </header>

        <div className={c("rgx-growth-cards")} role="list" aria-label={e.cardsLabel}>
          <Card icon={<SearchIcon />} title={e.search.title} body={e.search.body} foot={e.search.foot}>
            <div className={c("rgx-growth-visual-panel rgx-search-panel")}>
              <div className={c("rgx-graph-top")}>
                <div>
                  <small>{e.search.label}</small>
                  <strong>
                    {e.search.value} <span aria-hidden="true">↗</span>
                  </strong>
                </div>
                <span className={c("rise")}>{e.search.rise}</span>
              </div>
              <svg className={c("rgx-search-svg")} viewBox="0 0 260 120" role="img" aria-label={e.search.chartLabel}>
                <defs>
                  <linearGradient id="rgx-search-area-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f29a71" stopOpacity=".27" />
                    <stop offset="1" stopColor="#f29a71" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className={c("grid")} d="M0 22H260M0 55H260M0 88H260M0 119H260" />
                <path className={c("area")} d="M2 110C20 105 35 101 54 96S90 99 109 75S142 83 160 61S193 69 210 37S235 35 255 14V120H2Z" />
                <path className={c("trend")} d="M2 110C20 105 35 101 54 96S90 99 109 75S142 83 160 61S193 69 210 37S235 35 255 14" />
                <circle className={c("endpoint")} cx="255" cy="14" r="5" />
              </svg>
              <div className={c("rgx-graph-labels")}>
                {e.search.weeks.map((week) => (
                  <span key={week}>{week}</span>
                ))}
              </div>
            </div>
          </Card>

          <Card icon={<CalendarIcon />} title={e.social.title} body={e.social.body} foot={e.social.foot}>
            <div className={c("rgx-social-floater")}>
              <span className={c("mini-dot")} />
              {e.social.ready} ✓
            </div>
            <div className={c("rgx-growth-visual-panel rgx-social-panel")}>
              <div className={c("rgx-social-panel-top")}>
                <span>{e.social.calendar}</span>
                <span>{e.social.scheduled}</span>
              </div>
              <div className={c("rgx-social-calendar")}>
                {days.map((day, i) => (
                  <div key={day} className={c("rgx-social-day")}>
                    <b>{day}</b>
                    <div className={c("rgx-social-slot")}>
                      {Array.from({ length: SLOTS[i] }, (_, n) => (
                        <i key={n} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className={c("rgx-social-panel-foot")}>
                <span>{e.social.queue}</span>
                <strong>{e.social.channels} ↗</strong>
              </div>
            </div>
          </Card>

          <Card icon={<SparkIcon />} title={e.ai.title} body={e.ai.body} foot={e.ai.foot}>
            <div className={c("rgx-growth-visual-panel rgx-ai-panel")}>
              <div className={c("rgx-ai-platforms")}>
                {["ChatGPT", "Gemini", "Perplexity"].map((name) => (
                  <span key={name} className={c("rgx-ai-pill")}>
                    <i /> {name}
                  </span>
                ))}
              </div>
              <p className={c("question")}>{e.ai.question}</p>
              <div className={c("rgx-ai-answer")}>
                <span className={c("star")} aria-hidden="true">
                  ✳
                </span>
                <p>
                  <strong>RepGet</strong> {e.ai.answer}
                </p>
              </div>
              <div className={c("rgx-ai-answer-foot")}>
                <b aria-hidden="true">✓</b>
                <span>{e.ai.found}</span>
              </div>
            </div>
          </Card>

          <Card icon={<LinkIcon />} title={e.links.title} body={e.links.body} foot={e.links.foot}>
            <div className={c("rgx-growth-visual-panel rgx-link-panel")}>
              <div className={c("rgx-link-top")}>
                <span>{e.links.label}</span>
                <strong>{e.links.network}</strong>
              </div>
              <div className={c("rgx-link-visual")} aria-hidden="true">
                <svg viewBox="0 0 245 135">
                  <path className={c("link-line")} d="M123 75 32 29M123 75 210 26M123 75 49 121M123 75 220 112" />
                  <path className={c("link-line live")} d="M123 75 32 29M123 75 210 26M123 75 49 121M123 75 220 112" />
                </svg>
                <span className={c("rgx-link-dot a")}>↗</span>
                <span className={c("rgx-link-dot b")}>✳</span>
                <span className={c("rgx-link-dot c")}>◈</span>
                <span className={c("rgx-link-dot d")}>↗</span>
                <span className={c("rgx-link-dot origin")}>R</span>
              </div>
            </div>
          </Card>
        </div>

        <div className={c("rgx-growth-four-bottom")}>
          <a href="#how-it-works">
            {e.link} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function Card({ icon, title, body, foot, children }: { icon: ReactNode; title: string; body: string; foot: string; children: ReactNode }) {
  return (
    <div className={c("rgx-growth-card")} role="listitem">
      <div className={c("rgx-growth-card-head")}>
        <span className={c("rgx-growth-card-icon")}>{icon}</span>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className={c("rgx-growth-art")}>
        <div className={c("rgx-growth-graphic")}>{children}</div>
      </div>
      <div className={c("rgx-growth-card-foot")}>
        <span className={c("status-dot")} />
        <span>{foot}</span>
      </div>
    </div>
  );
}

/* The four engines' marks, from the design (stroke set by the stylesheet). */
function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m5 16 5-5 4 3 5-8" />
      <path d="M14 6h5v5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M5 5.5h14v13H5z" />
      <path d="M8 3v5m8-5v5M5 10h14M8 14h3m3 0h3M8 17h3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M10 14 14 10" />
      <path d="M8 16H6a4 4 0 0 1 0-8h4m4 0h4a4 4 0 0 1 0 8h-4" />
    </svg>
  );
}
