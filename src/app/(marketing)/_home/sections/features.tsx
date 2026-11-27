import Link from "next/link";

import { FeatureLoop } from "@/components/marketing/feature-loop";
import { featuresPageCopy } from "@/lib/i18n/features-page";
import { featureClip, PRODUCT_TOOLS, TOOL_ANCHORS, TOOL_FEATURES } from "@/lib/marketing/product-tools";

import type { SectionProps } from "../types";
import styles from "./features.module.css";

const HEADING_ID = "home-features-heading";

/** The cards' width at each breakpoint (features.module.css), for the posters' srcset. */
const CLIP_SIZES = "(min-width: 1024px) 600px, (min-width: 640px) 50vw, 100vw";

/**
 * "Top features" (client, 2026-11-27), right after "Meet RepGet.": the five
 * tools (lib/marketing/product-tools.ts), each with its dashboard recording,
 * and "See all features" to /features. It replaced the dark "Explore the
 * platform" shell and its nine drawn capabilities, which counted the product
 * differently from the menu and the pricing table.
 *
 * Light on purpose: the words are server-rendered; each card shows a lazy,
 * resized poster and its loop loads only when the card is reached, never with
 * reduced motion (components/marketing/feature-loop.tsx). Nothing here is
 * fetched before the visitor scrolls to it.
 *
 * The id stays `features`: links to /#features keep landing here.
 */
export function Features({ locale, href }: SectionProps) {
  const t = featuresPageCopy(locale);
  const features = href("/features");

  return (
    <section id="features" className={styles.section} aria-labelledby={HEADING_ID}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{t.home.eyebrow}</p>
          <h2 id={HEADING_ID} className={styles.title}>
            {t.home.title}
          </h2>
          <p className={styles.sub}>{t.home.sub}</p>
        </div>

        <ol className={styles.grid}>
          {PRODUCT_TOOLS.map((tool, index) => {
            const words = t.tools[tool];
            const first = TOOL_FEATURES[tool][0];
            const clip = featureClip(first);
            return (
              <li key={tool} className={styles.card}>
                <FeatureLoop
                  mp4={clip.mp4}
                  poster={clip.poster}
                  label={t.clipLabel.replace("{feature}", t.features[first].title)}
                  sizes={CLIP_SIZES}
                  className={styles.clip}
                />
                <div className={styles.body}>
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className={styles.name}>
                    {/* The whole card is the link (the ::after stretches it). */}
                    <Link prefetch={false} href={`${features}#${TOOL_ANCHORS[tool]}`} className={styles.link}>
                      {words.name}
                    </Link>
                  </h3>
                  <p className={styles.tagline}>{words.tagline}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className={styles.foot}>
          <p className={styles.copilot}>
            <b>{t.copilot.name}</b> {t.copilot.tagline}
          </p>
          <Link prefetch={false} href={features} className={styles.all}>
            {t.home.seeAll} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
