import { BRAND_NAMES, BrandIcon, type BrandIconName } from "@/components/brand-icons";
import { CountUp } from "../count-up";
import styles from "../home.module.css";
import type { SectionProps } from "../types";
import ribbon from "./hero.module.css";

/**
 * The search engines, AI assistants, social networks and site builders the
 * ribbon names - only ones RepGet really publishes to, reads from or is
 * checked against. The design's ribbon also had LinkedIn and Meta's
 * wordmark; LinkedIn is not connected (components/brand-icons.tsx) and
 * Facebook and Instagram are named on their own.
 */
const BRANDS: BrandIconName[] = [
  "google",
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "reddit",
  "quora",
  "x",
  "threads",
  "pinterest",
  "bluesky",
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "wordpress",
  "shopify",
  "webflow",
  "wix",
  "ghost",
];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <ul className={styles.marqueeGroup} aria-hidden={hidden || undefined}>
      {BRANDS.map((name) => (
        <li key={name} className={styles.brand}>
          <span className={`${ribbon.brandTile} ${styles[`b-${name}`]}`}>
            <BrandIcon name={name} className={ribbon.brandTileIcon} />
          </span>
          {BRAND_NAMES[name]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The platform ribbon and the content counter, under the hero (client's
 * design, 2026-11-03).
 *
 * The marquee is one list drawn twice: the track slides by exactly half its
 * width, so the second copy takes the first's place and the loop has no
 * seam. The copy is aria-hidden, so the names are read once. It pauses under
 * the mouse, and stands still under reduced motion (home.module.css).
 *
 * The counter is the real number of articles, posts and videos RepGet has
 * made (lib/marketing/content-count.ts) - not the design's 12,840 ticking up
 * at random. When that count is unavailable the counter is left out rather
 * than shown as zero or guessed, and the ribbon takes the full width.
 */
export function Ribbon({ c, locale, contentCount }: SectionProps & { contentCount: number | null }) {
  return (
    <section className={styles.ribbon} aria-label={c.ribbon.label}>
      <div
        className={styles.ribbonInner}
        // Without a counter, its 340px column would be an empty gap.
        style={contentCount !== null ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>
            <Group />
            <Group hidden />
          </div>
        </div>
        {contentCount !== null ? (
          <div className={`${styles.counter} ${styles.reveal}`} data-reveal="">
            <CountUp value={contentCount} locale={locale} className={styles.counterValue} />
            <span className={styles.counterLabel}>{c.ribbon.counterLabel}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
