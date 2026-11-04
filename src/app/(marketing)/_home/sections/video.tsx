import { storyCopy } from "@/lib/i18n/home/story";
import { walkthroughWatchUrl } from "@/lib/marketing/walkthrough";

import { DemoPlayer } from "../demo-player";
import type { SectionProps } from "../types";

import styles from "./video.module.css";

/** Maps the design's class names to this module's, so the markup reads like the design. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/**
 * "See RepGet in two minutes." - the walkthrough, ported from the client's
 * approved design (design.html, section `rgx-video-section`, 2026-11-04):
 * the YouTube thumbnail with a round play button, the player only after a
 * press (DemoPlayer), and the caption row with "Watch on YouTube", which also
 * serves a browser that blocks the embed or runs no JavaScript.
 *
 * The hero's "watch" link scrolls here, so the id is the design's and must
 * not change.
 */
export function VideoSection({ locale }: SectionProps) {
  const v = storyCopy(locale).video;

  return (
    <section id="repget-demo-video" className={c("rgx-video-section")} aria-labelledby="rgx-video-heading">
      <div className={c("rgx-video-inner")}>
        <header className={c("rgx-video-heading")}>
          <span className={c("rgx-video-eyebrow")}>
            <i aria-hidden="true" />
            {v.eyebrow}
          </span>
          <h2 id="rgx-video-heading">{v.title}</h2>
          <p>{v.sub}</p>
        </header>
        <div className={c("rgx-video-frame")}>
          <DemoPlayer playLabel={v.play} frameTitle={v.frameTitle} lang={locale} />
        </div>
        <div className={c("rgx-video-caption")}>
          <span>
            <strong>{v.walkthrough}</strong> &nbsp;·&nbsp; {v.duration}
          </span>
          <a href={walkthroughWatchUrl()} target="_blank" rel="noopener noreferrer">
            {v.watch} <span aria-hidden="true">↗</span>
            <span className={c("sr-only")}> {v.opensInNewTab}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
