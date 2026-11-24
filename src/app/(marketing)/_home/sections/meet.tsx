import Image from "next/image";
import type { CSSProperties } from "react";

import { heroCopy } from "@/lib/i18n/home/hero";
import type { SectionProps } from "../types";
import styles from "./meet.module.css";

const TITLE_ID = "home-meet-title";

/** The brand in the title, the same in every language. */
const BRAND = "RepGet.";

/**
 * "Meet [the gecko and the owl] RepGet.", under the platform ribbon (client,
 * 2026-11-24, repget_homepage_animated_signals.html `rg-meet-peek`). It was
 * the hero's title, large and moving, and drew attention from the promise;
 * here it is small and the mascots stand still.
 */
export function Meet({ locale }: SectionProps) {
  const t = heroCopy(locale).meet;
  // How long the title's line is, for its size (meet.module.css).
  const titleChars = { "--title-chars": t.meet.length + BRAND.length } as CSSProperties;

  return (
    <section className={styles.meet} aria-labelledby={TITLE_ID}>
      <p className={styles.eyebrow}>{t.eyebrow}</p>
      {/* The spaces keep the heading's words apart for a screen reader; the line's layout ignores them. */}
      <h2 id={TITLE_ID} className={styles.title} style={titleChars}>
        <span>{t.meet}</span>{" "}
        <span className={styles.mascots} aria-hidden="true">
          <Image className={styles.gecko} src="/images/home/hero/gecko-still.webp" alt="" width={160} height={160} unoptimized />
          <Image className={styles.owl} src="/images/home/hero/owl-still.webp" alt="" width={160} height={160} unoptimized />
          <span className={styles.star}>✳</span>
          <span className={styles.starTwo}>✦</span>
        </span>{" "}
        <span className={styles.brand}>{BRAND}</span>
      </h2>
    </section>
  );
}
