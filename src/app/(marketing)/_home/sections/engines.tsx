import { Fragment, type CSSProperties, type ReactNode } from "react";

import { BRAND_NAMES, BrandIcon } from "@/components/brand-icons";
import type { Locale } from "@/lib/i18n/config";

import styles from "../home.module.css";
import { plain, rich } from "../text";
import type { SectionProps } from "../types";

import fx from "./features.module.css";

const HEADING_ID = "home-engines-heading";

/** How many posts each weekday of the drawn calendar holds: a shape, not a schedule. */
const SLOTS = [3, 2, 3, 2, 3];

/** Monday to Friday in the visitor's language (5 January 2026 was a Monday). */
function weekdays(locale: Locale): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return SLOTS.map((_, i) => format.format(new Date(Date.UTC(2026, 0, 5 + i))));
}

/**
 * The AI answer, one span per word so the stylesheet can "type" it in once
 * the section is on screen. `**bold**` stays bold; nothing else is markup.
 */
function typedAnswer(text: string): ReactNode {
  let index = 0;
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((segment, s) => {
      const bold = /^\*\*([^*]+)\*\*$/.exec(segment);
      const words = (bold?.[1] ?? plain(segment)).split(/(\s+)/).map((word, w) =>
        word.trim() === "" ? (
          word
        ) : (
          <span key={w} className={fx.word} style={{ "--word": index++ } as CSSProperties}>
            {word}
          </span>
        ),
      );
      return bold ? <strong key={s}>{words}</strong> : <Fragment key={s}>{words}</Fragment>;
    });
}

/**
 * "One platform. Four growth engines." - the dark band of four tilted cards
 * (client's design, 2026-11-03).
 *
 * The little drawings are pure CSS: the section carries `data-reveal`, the
 * page's RevealRoot marks it `data-shown` once it scrolls in, and that starts
 * the trend line, the calendar filling up, the AI answer typing and the link
 * lines. They show what each engine does, never a result, so they carry no
 * figures; each says it is an illustration for screen readers.
 */
export function Engines({ c, locale }: SectionProps) {
  const e = c.engines;
  const days = weekdays(locale);
  const note = <span className={styles.srOnly}>{e.illustration}</span>;

  return (
    <section id="growth-engines" className={styles.engines} aria-labelledby={HEADING_ID} data-reveal>
      <div className={styles.enginesInner}>
        <header className={`${styles.enginesHead} ${styles.reveal}`} data-reveal>
          <div>
            <span className={styles.kicker}>{plain(e.eyebrow)}</span>
            <h2 id={HEADING_ID}>{rich(e.title)}</h2>
          </div>
          <p>{plain(e.sub)}</p>
        </header>

        <ul className={`${styles.engineCards} ${styles.reveal}`} data-reveal data-delay="1">
          <Card icon={<SearchIcon />} title={e.search.title} body={e.search.body} foot={e.search.foot}>
            {note}
            <div className={styles.enginePanel}>
              <div className={styles.panelTop}>
                <div>
                  <small>{e.search.label}</small>
                  <strong>
                    {e.search.value} <span aria-hidden="true">↗</span>
                  </strong>
                </div>
                <span className={styles.pill}>{e.search.rise}</span>
              </div>
              <svg className={styles.trendSvg} viewBox="0 0 260 120" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="home-engines-trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f29a71" stopOpacity=".27" />
                    <stop offset="1" stopColor="#f29a71" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 22H260M0 55H260M0 88H260M0 119H260" stroke="#7e8291" strokeOpacity=".13" strokeDasharray="3 7" />
                <path d="M2 110C20 105 35 101 54 96S90 99 109 75S142 83 160 61S193 69 210 37S235 35 255 14V120H2Z" fill="url(#home-engines-trend-fill)" />
                <path className={styles.trendLine} d="M2 110C20 105 35 101 54 96S90 99 109 75S142 83 160 61S193 69 210 37S235 35 255 14" />
                <circle className={styles.trendDot} cx="255" cy="14" r="5" />
              </svg>
              <div className={styles.weeks}>
                {e.search.weeks.map((week) => (
                  <span key={week}>{week}</span>
                ))}
              </div>
            </div>
          </Card>

          <Card icon={<CalendarIcon />} title={e.social.title} body={e.social.body} foot={e.social.foot}>
            {note}
            <div className={styles.floater}>
              {e.social.ready} <span aria-hidden="true">✓</span>
            </div>
            <div className={styles.enginePanel}>
              <div className={styles.panelTop}>
                <span className={fx.panelTitle}>{e.social.calendar}</span>
                <span className={styles.pill}>{e.social.scheduled}</span>
              </div>
              <div className={styles.calendar}>
                {days.map((day, i) => (
                  <div key={day} className={styles.day}>
                    <b>{day}</b>
                    <div className={styles.slot} aria-hidden="true">
                      {Array.from({ length: SLOTS[i] ?? 0 }, (_, j) => (
                        <i key={j} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.panelFoot}>
                <span>{e.social.queue}</span>
                <strong>
                  {e.social.channels} <span aria-hidden="true">↗</span>
                </strong>
              </div>
            </div>
          </Card>

          <Card icon={<SparkIcon />} title={e.ai.title} body={e.ai.body} foot={e.ai.foot}>
            {note}
            <div className={styles.enginePanel}>
              <div className={styles.aiPills}>
                {(["chatgpt", "gemini", "perplexity"] as const).map((brand) => (
                  <span key={brand}>
                    <BrandIcon name={brand} />
                    {BRAND_NAMES[brand]}
                  </span>
                ))}
              </div>
              <p className={styles.aiQuestion}>{plain(e.ai.question)}</p>
              <div className={styles.aiAnswer}>
                <span className={fx.star} aria-hidden="true">
                  ✳
                </span>
                <p className={`${fx.answerText} ${styles.typing}`}>{typedAnswer(e.ai.answer)}</p>
              </div>
              <div className={styles.aiFound}>
                <CheckIcon />
                <span>{e.ai.found}</span>
              </div>
            </div>
          </Card>

          <Card icon={<LinkIcon />} title={e.links.title} body={e.links.body} foot={e.links.foot}>
            {note}
            <div className={styles.enginePanel}>
              <div className={styles.panelTop}>
                <span>{e.links.label}</span>
                <span className={styles.pill}>{e.links.network}</span>
              </div>
              <div className={styles.linkVisual} aria-hidden="true">
                <svg viewBox="0 0 245 135" focusable="false">
                  <path d="M123 75 32 29M123 75 210 26M123 75 49 121M123 75 220 112" fill="none" stroke="#be956e" strokeWidth="1.7" strokeDasharray="5 7" opacity=".65" />
                  <path className={styles.linkLine} d="M123 75 32 29M123 75 210 26M123 75 49 121M123 75 220 112" />
                </svg>
                <span className={`${styles.node} ${styles.n1}`}>
                  <BrandIcon name="link" />
                </span>
                <span className={`${styles.node} ${styles.n2}`}>
                  <BrandIcon name="spark" />
                </span>
                <span className={`${styles.node} ${styles.n3}`}>
                  <BrandIcon name="globe" />
                </span>
                <span className={`${styles.node} ${styles.n4}`}>
                  <BrandIcon name="file" />
                </span>
                <span className={`${styles.node} ${styles.nodeOrigin}`}>R</span>
              </div>
            </div>
          </Card>
        </ul>

        <div className={styles.enginesBottom}>
          {/* Down to the three steps, as the design does (#rgx-how there). */}
          <a className={`${styles.ghostLink} ${fx.focusable}`} href="#how-it-works">
            {plain(e.link)} <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function Card({ icon, title, body, foot, children }: { icon: ReactNode; title: string; body: string; foot: string; children: ReactNode }) {
  return (
    <li className={styles.engine}>
      <div className={styles.engineHead}>
        <span className={styles.engineIcon}>{icon}</span>
        <h3>{plain(title)}</h3>
        <p>{plain(body)}</p>
      </div>
      <div className={styles.engineArt}>{children}</div>
      <div className={styles.engineFoot}>{foot}</div>
    </li>
  );
}

/* The four engines' marks, from the design. */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...stroke}>
      <path d="m5 16 5-5 4 3 5-8" />
      <path d="M14 6h5v5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...stroke}>
      <path d="M5 5.5h14v13H5z" />
      <path d="M8 3v5m8-5v5M5 10h14M8 14h3m3 0h3M8 17h3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...stroke}>
      <path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...stroke}>
      <path d="M10 14 14 10" />
      <path d="M8 16H6a4 4 0 0 1 0-8h4m4 0h4a4 4 0 0 1 0 8h-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...stroke}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}
