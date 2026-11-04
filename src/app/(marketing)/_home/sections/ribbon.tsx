import type { ReactNode } from "react";

import { heroCopy } from "@/lib/i18n/home/hero";
import { CountUp } from "../count-up";
import type { SectionProps } from "../types";
import styles from "./hero.module.css";

/** The design's class names, hyphens and all, mapped to the module's. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/** The design's twelve platforms (`rgx-channel-ribbon`), each with its own small mark. */
const BRANDS: { name: string; mark: ReactNode }[] = [
  { name: "Google", mark: <span className={c("rgx-brand-google")}>G</span> },
  { name: "ChatGPT", mark: <span className={c("rgx-brand-openai")}>✺</span> },
  {
    name: "Instagram",
    mark: (
      <svg className={c("rgx-brand-instagram")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.7" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    mark: (
      <svg className={c("rgx-brand-linkedin")} viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor" />
        <path
          d="M7 10v8M7 7v.1M11 18v-8h3v1.2c.6-1 1.6-1.4 2.7-1.4 2.1 0 2.3 1.4 2.3 3.5V18"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "YouTube",
    mark: (
      <svg className={c("rgx-brand-youtube")} viewBox="0 0 24 24">
        <rect x="1" y="5" width="22" height="14" rx="4" fill="currentColor" />
        <path d="m10 8 6 4-6 4z" fill="white" />
      </svg>
    ),
  },
  {
    name: "X",
    mark: (
      <svg className={c("rgx-brand-x")} viewBox="0 0 24 24">
        <path d="M18.9 2h3.2L15 10.2 23 22h-6.6l-5.3-7.3L4.7 22H1.5l7.9-9L1.5 2h6.7l4.8 6.7L18.9 2Zm-1.2 18h1.8L7.2 3.9H5.3Z" fill="currentColor" />
      </svg>
    ),
  },
  { name: "Pinterest", mark: <span className={c("rgx-brand-pinterest")}>P</span> },
  {
    name: "Meta",
    mark: (
      <svg className={c("rgx-brand-meta")} viewBox="0 0 30 20" fill="none">
        <path
          d="M2 15.5C2 8.5 7.2 3 11 8.5l4 5.4 4-5.4c4-5.4 9.5-.5 9.5 5.5 0 6.5-6.3 5.4-9.6.8l-4-5.6-3.6 5.6C7.6 20 2 21 2 15.5Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "TikTok",
    mark: (
      <svg className={c("rgx-brand-tiktok")} viewBox="0 0 24 24">
        <path fill="currentColor" d="M16 2c.2 2.5 1.7 4.2 4.3 4.5v3.2c-1.8-.1-3.2-.6-4.3-1.4v6.4a5.6 5.6 0 1 1-5.6-5.6h.7v3.3a2.4 2.4 0 1 0 1.9 2.3V2h3Z" />
      </svg>
    ),
  },
  { name: "Threads", mark: <span className={c("rgx-brand-threads")}>@</span> },
  {
    name: "Reddit",
    mark: (
      <svg className={c("rgx-brand-reddit")} viewBox="0 0 24 24">
        <circle cx="12" cy="13" r="8" fill="currentColor" />
        <circle cx="8.5" cy="12" r="1.2" fill="white" />
        <circle cx="15.5" cy="12" r="1.2" fill="white" />
        <path d="M8 16c2.3 1.6 5.7 1.6 8 0" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Bluesky",
    mark: (
      <svg className={c("rgx-brand-bluesky")} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 11C10 7 5.3 3 2.5 3c-2.2 0-1.6 5.5-.4 7.5C3 12.4 5 13.3 8 13.5c-2.8-.4-5.4 1.1-4.4 3.6 1.5 4 6.3 2.3 8.4-2.4 2.1 4.7 6.9 6.4 8.4 2.4 1-2.5-1.6-4-4.4-3.6 3-.2 5-.9 5.9-2.9 1.2-2 1.8-7.5-.4-7.5-2.8 0-7.5 4-9.5 8Z" />
      </svg>
    ),
  },
];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <ul className={c("rgx-channel-group")} aria-hidden={hidden || undefined}>
      {BRANDS.map((brand) => (
        <li key={brand.name} className={c("rgx-channel-brand")}>
          <span aria-hidden="true" style={{ display: "contents" }}>
            {brand.mark}
          </span>
          {brand.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * The platform ribbon and the content counter, under the hero (client's
 * design, 2026-11-03, `rgx-channel-ribbon`).
 *
 * The marquee is one list drawn twice: the track slides by exactly half its
 * width, so the second copy takes the first's place and the loop has no
 * seam. The copy is aria-hidden, so the names are read once. It pauses under
 * the mouse and stands still under reduced motion.
 *
 * The counter is the real number of articles, posts and videos RepGet has
 * made (lib/marketing/content-count.ts), counting up the first time it is
 * seen - not the design's 12,840 ticking up at random. When that count is
 * unavailable the counter is left out rather than shown as zero or guessed,
 * and the marquee takes the full width.
 */
export function Ribbon({ locale, contentCount }: SectionProps & { contentCount: number | null }) {
  const t = heroCopy(locale).ribbon;
  return (
    <section className={c("rgx-channel-ribbon")} aria-label={t.label}>
      <div className={c("rgx-channel-ribbon-inner")} data-count={contentCount === null ? "none" : undefined}>
        <div className={c("rgx-channel-ribbon-left")}>
          <div className={c("rgx-channel-viewport")}>
            <div className={c("rgx-channel-track")}>
              <Group />
              <Group hidden />
            </div>
          </div>
        </div>
        {contentCount !== null ? (
          <div className={c("rgx-channel-activity")}>
            <div className={c("rgx-channel-count-wrap")}>
              <CountUp value={contentCount} locale={locale} className={c("rgx-channel-count")} />
              <span className={c("rgx-channel-count-text")}>{t.counterLabel}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
