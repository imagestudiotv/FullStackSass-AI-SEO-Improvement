import Link from "next/link";
import type { ReactNode } from "react";

import { copilotFounderReviewsCopy } from "@/lib/i18n/home/copilot-founder-reviews";

import type { SectionProps } from "../types";
import styles from "./copilot.module.css";

/** The design's class names, through the module: `c("rgx-chat-line dot")`. */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * The design's platform marks (its `rgint-i-*` sprite), drawn in the tile's
 * colour: dark glyphs on white tiles, as the design has them.
 */
const GLYPHS = {
  linkedin: (
    <path
      d="M4.3 2.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM2.4 9h3.8v12.5H2.4zM8.5 9h3.6v1.7h.1a4.1 4.1 0 0 1 3.6-2c3.8 0 4.5 2.5 4.5 5.8v7h-3.8v-6.2c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2v6.3H8.5V9z"
      fill="currentColor"
    />
  ),
  threads: (
    <path
      d="M16.8 9c-.8-2.1-2.5-3.1-4.7-3.1-3.9 0-6.2 2.9-6.2 6.4 0 4.3 2.4 6.5 6.6 6.5 4 0 6.5-2.5 6.5-6.2 0-2.4-1.6-4-4.1-4-2.8 0-4.5 1.5-4.5 3.3 0 1.5 1 2.3 2.5 2.3 2.1 0 3.4-1.7 3.4-4.6 0-5.1-3-8.1-8.3-8.1-5.5 0-9.2 3.7-9.2 9.3 0 5.5 3.4 9.1 9.4 9.1 6 0 9.3-3.8 9.3-8.6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.55"
      transform="translate(1.5 -1.2) scale(.86)"
    />
  ),
  pinterest: (
    <path
      d="M12.3 2C6.5 2 3 6.2 3 11.1c0 3 1.3 5.4 3.8 6.4.4.1.7 0 .8-.4l.3-1.4c.1-.4 0-.5-.3-.9-.7-.8-1.2-1.9-1.2-3.4 0-4.3 3-7.6 7.2-7.6 3.6 0 5.6 2.2 5.6 5.2 0 3.9-1.7 7.1-4.1 7.1-1.4 0-2.4-1.2-2-2.7.4-1.8 1.3-3.8 1.3-5.1 0-1.2-.6-2.2-1.9-2.2-1.5 0-2.7 1.5-2.7 3.6 0 1.3.4 2.1.4 2.1L7.7 22h2.1l1.7-6.1c.6 1.1 2 2 3.7 2 4.9 0 8-4.5 8-9.1C23.2 4.9 19 2 12.3 2Z"
      fill="currentColor"
      transform="translate(1.1 0) scale(.91)"
    />
  ),
  bluesky: (
    <path
      d="M12 10.8C9.4 7.4 5.5 3.8 3.2 5.4c-2.4 1.7 0 6.7 1.8 8.2 1.2 1 3.5 1.5 5 1.3-4.6.8-5.7 3.3-3 5.7 2.4 1.8 4.4-.4 5.2-2.1.8 1.7 2.8 3.9 5.2 2.1 2.7-2.4 1.6-4.9-3-5.7 1.5.2 3.8-.3 5-1.3 1.8-1.5 4.2-6.5 1.8-8.2-2.3-1.6-6.2 2-8.8 5.4Z"
      fill="currentColor"
    />
  ),
  youtube: <path d="m9 6.8 9 5.2-9 5.2V6.8Z" fill="currentColor" />,
  x: <path d="M3 2h4.2L21 22h-4.2L3 2Zm17.3 0L3.7 22" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" />,
  gsc: (
    <>
      <rect fill="none" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" width="16" x="4" y="4" />
      <path d="M7 16v-3l3-3 3 2 4-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </>
  ),
  ig: (
    <>
      <rect fill="none" height="18" rx="5" stroke="currentColor" strokeWidth="2" width="18" x="3" y="3" />
      <circle cx="12" cy="12" fill="none" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.7" fill="currentColor" r="1.25" />
    </>
  ),
  file: (
    <>
      <rect fill="none" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" width="14" x="5" y="3" />
      <path d="M8 9h8m-8 4h8m-8 4h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </>
  ),
  tiktok: (
    <>
      <path
        d="M15 3.4c.4 2.7 2.2 4.4 5 4.8v3.5c-1.9-.1-3.6-.7-5-1.8v5.9a6.2 6.2 0 1 1-6.2-6.2v3.6a2.6 2.6 0 1 0 2.6 2.6V2h3.6v1.4Z"
        fill="currentColor"
      />
      <path d="M15 4.2v6m-5-1.1v4" fill="none" stroke="#fe2c55" strokeWidth=".8" />
    </>
  ),
  fb: (
    <path
      d="M14.8 22V13h3l.5-4H14.8V6.6c0-1.2.4-2 2.2-2h1.5V1.1a21 21 0 0 0-2.5-.1C12 1 10 3.2 10 6.3V9H7v4h3v9h4.8Z"
      fill="currentColor"
    />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c-5 5.5-5 12.5 0 18M12 3c5 5.5 5 12.5 0 18" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

type Glyph = keyof typeof GLYPHS;

function Mark({ name }: { name: Glyph }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  );
}

/** The strip's twelve tiles, in the design's order. Names are brands: the same in every language, except the two generic ones. */
const STRIP: { glyph: Glyph; name: string }[] = [
  { glyph: "linkedin", name: "LinkedIn" },
  { glyph: "threads", name: "Threads" },
  { glyph: "pinterest", name: "Pinterest" },
  { glyph: "bluesky", name: "Bluesky" },
  { glyph: "youtube", name: "YouTube" },
  { glyph: "x", name: "X" },
  { glyph: "gsc", name: "Google Search Console" },
  { glyph: "ig", name: "Instagram" },
  { glyph: "file", name: "Blog" },
  { glyph: "tiktok", name: "TikTok" },
  { glyph: "fb", name: "Facebook" },
  { glyph: "globe", name: "Website" },
];

const DOTS = ["dot", "dot orange", "dot blue"] as const;

/**
 * Growth AI Chat Copilot (client's design, design.html
 * `#repget-copilot-connect`): the strip of the accounts it connects, then
 * the dark card with what it does and a drawn conversation.
 *
 * The conversation is an illustration of the product, not an account.
 */
export function Copilot({ locale, href }: SectionProps) {
  const t = copilotFounderReviewsCopy(locale).copilot;

  return (
    <section className={c("rgx-copilot-connect")} id="repget-copilot-connect" aria-labelledby="rgx-copilot-heading">
      <div className={c("rgx-copilot-shell")}>
        <div className={c("rgx-connect-strip")}>
          <p className={c("rgx-connect-strip-title")}>{t.strip}</p>
          <ul className={c("rgx-connect-icons")} aria-label={t.stripLabel}>
            {STRIP.map(({ glyph, name }) => (
              <li key={glyph} className={c("rgx-connect-icon")} title={name}>
                <Mark name={glyph} />
                <span className="sr-only">{name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={c("rgx-connect-card")}>
          <div className={c("rgx-connect-copy")}>
            <span className={c("rgx-connect-kicker")}>
              <i aria-hidden="true" /> {t.kicker}
            </span>
            <h2 id="rgx-copilot-heading">{t.title}</h2>
            <p>{t.body}</p>
            <ul className={c("rgx-copilot-steps")}>
              {t.points.map((point) => (
                <li key={point.lead}>
                  <i aria-hidden="true" />
                  <span>
                    <b>{point.lead}</b> {point.text}
                  </span>
                </li>
              ))}
            </ul>
            <div className={c("rgx-connect-actions")}>
              <Link prefetch={false} href={href("/sign-up")} className={c("rgx-connect-btn")}>
                {t.connect}
              </Link>
              <a href="#repget-demo-video" className={c("rgx-connect-ghost")}>
                {t.watch}
              </a>
            </div>
          </div>

          <div className={c("rgx-connect-visual")} role="img" aria-label={t.previewLabel}>
            <div className={c("rgx-grid-backdrop")} aria-hidden="true" />
            <div className={c("rgx-connect-mini left")} aria-hidden="true">
              <Mark name="globe" /> {t.site}
            </div>
            <div className={c("rgx-connect-mini right")} aria-hidden="true">
              <Mark name="ig" /> {t.channelsConnected}
            </div>
            <div className={c("rgx-chat-shell")} aria-hidden="true">
              <div className={c("rgx-chat-bubble user")}>{t.userMessage}</div>
              <div className={c("rgx-chat-status")}>
                <i>✳</i> {t.status}
              </div>
              <ul className={c("rgx-chat-lines")}>
                {t.lines.map((line, index) => (
                  <li key={line} className={c("rgx-chat-line")}>
                    <span className={c(DOTS[index])} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className={c("rgx-chat-input")}>{t.input}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
