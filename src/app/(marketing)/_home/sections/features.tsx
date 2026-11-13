import Image from "next/image";

import { featuresCopy } from "@/lib/i18n/home/features";

import { TopFeaturesStage } from "../top-features-stage";
import { TopFeaturesTabs } from "../top-features-tabs";
import type { SectionProps } from "../types";

import styles from "./top-features.module.css";

const HEADING_ID = "home-features-heading";

/**
 * "Top features" (client's design, 2026-11-03, #repget-dashboard-showcase):
 * the feature selector with the gecko-and-owl mascot centred on its top edge.
 *
 * On desktop the section is pulled up under the ribbon so the mascot peeks at
 * the bottom of the first screen ("perfect visible at the end to reveal
 * curiosity"), and the board starts small and grows to full size as the
 * visitor scrolls (top-features-stage.tsx).
 *
 * The id stays `features`: the header's links and the Social tool point at
 * /#features.
 */
export function Features({ locale }: SectionProps) {
  const f = featuresCopy(locale);

  return (
    <section id="features" className={styles["rgx-dashboard-embed"]} aria-labelledby={HEADING_ID}>
      <TopFeaturesStage className={styles["hp-reveal-stage"]}>
        <div className={styles["hp-preview-wrap"]}>
          <div className={styles["hp-preview-label"]}>
            <h2 id={HEADING_ID}>
              <span className={styles["hp-dot"]} aria-hidden="true" />
              {f.label}
            </h2>
            <span>{f.hint}</span>
          </div>
          <TopFeaturesTabs items={f.items} labelledBy={HEADING_ID} note={f.note} next={f.next}>
            <div className={styles["hp-center-mascot"]}>
              <Image src="/images/home/mascot.webp" width={217} height={189} alt={f.mascotAlt} />
            </div>
          </TopFeaturesTabs>
        </div>
      </TopFeaturesStage>
    </section>
  );
}
