import Image from "next/image";

import { BRAND_NAMES, type BrandIconName } from "@/components/brand-icons";

import { FeatureSelector, type SelectorItem } from "../feature-selector";
import styles from "../home.module.css";
import { plain } from "../text";
import type { SectionProps } from "../types";

import fx from "./features.module.css";

const HEADING_ID = "home-features-heading";

/**
 * Chips that name a platform get its mark; the rest ("SEO", "Planning", and
 * every translated word) get the generic spark. Matched on the brand's own
 * spelling, which no translation changes.
 */
const BRAND_BY_NAME = new Map<string, BrandIconName>(
  (Object.entries(BRAND_NAMES) as [BrandIconName, string][])
    .filter(([, name]) => name !== "")
    .map(([icon, name]) => [name.toLowerCase(), icon]),
);

/**
 * "Top features": the boxed selector with the mascot perched on top
 * (client's design, 2026-11-03).
 *
 * The heading is drawn here; the interactive part (feature-selector.tsx) gets
 * only the strings it shows, so the dictionaries stay out of the browser
 * bundle. The selector is server-rendered too, with the first feature open.
 */
export function Features({ c }: SectionProps) {
  const f = c.features;
  const items: SelectorItem[] = f.items.map((item) => ({
    ...item,
    chipIcons: item.chips.map((chip) => BRAND_BY_NAME.get(chip.toLowerCase()) ?? "spark"),
  }));

  return (
    <section id="features" className={styles.features} aria-labelledby={HEADING_ID}>
      <div className={`${styles.featuresWrap} ${styles.reveal}`} data-reveal>
        <div className={styles.featuresLabel}>
          <h2 id={HEADING_ID} className={`${styles.kicker} ${fx.heading}`}>
            {plain(f.eyebrow)}
          </h2>
          <span>{f.hint}</span>
        </div>
        <FeatureSelector items={items} labelledBy={HEADING_ID} next={f.next} note={f.note} noteDetail={f.noteDetail}>
          <Image className={styles.mascot} src="/images/home/mascot.webp" width={217} height={189} alt="" />
        </FeatureSelector>
      </div>
    </section>
  );
}
