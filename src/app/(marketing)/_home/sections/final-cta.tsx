import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { format } from "@/lib/i18n/format";
import { FREE_ARTICLES } from "@/lib/plans/features";
import styles from "../home.module.css";
import { rich } from "../text";
import type { SectionProps } from "../types";
import local from "./closing.module.css";

/**
 * The closing call (client's design, 2026-11-03): the dark box with the two
 * ways to start on the left and what starting free includes on the right.
 *
 * The same two doors as the old closing call (home-sections.tsx ClosingCta):
 * the free website check (/audit, no account needed) first, then the free
 * articles at sign-up. {n} is FREE_ARTICLES, the number the checkout applies,
 * so the offer cannot promise more articles than the account gets.
 */
export function FinalCta({ c, href }: SectionProps) {
  const t = c.cta;
  const n = { n: FREE_ARTICLES };

  return (
    <section className={styles.final} aria-labelledby="final-cta-title">
      <div className={`${styles.finalBox} ${styles.reveal}`} data-reveal="">
        <div className={styles.finalDots} aria-hidden="true" />

        <div className={styles.finalCopy}>
          <div className={styles.kicker}>{t.overline}</div>
          <h2 id="final-cta-title">{rich(format(t.title, n))}</h2>
          <p>{rich(format(t.body, n))}</p>
          <div className={styles.finalActions}>
            <Link href={href("/audit")} className={`${styles.finalPrimary} ${local.focusRing}`}>
              {format(t.primary, n)}
              <ArrowRight className={local.arrow} aria-hidden="true" />
            </Link>
            <Link href={href("/sign-up")} className={`${styles.finalSecondary} ${local.focusRing}`}>
              {format(t.secondary, n)}
              <ArrowRight className={local.arrow} aria-hidden="true" />
            </Link>
          </div>
          <ul className={styles.finalPoints}>
            {t.points.map((point) => (
              <li key={point}>
                <Check aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.finalSide}>
          <ul className={styles.finalPills}>
            {t.pills.map((pill) => (
              <li key={pill}>{pill}</li>
            ))}
          </ul>
          <div className={styles.finalPanel}>
            <strong>{t.panelTitle}</strong>
            <small>{t.panelBody}</small>
            <ul className={styles.finalList}>
              {t.items.map((item) => (
                <li key={item.title}>
                  <strong>{format(item.title, n)}</strong>
                  <span>{format(item.body, n)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
