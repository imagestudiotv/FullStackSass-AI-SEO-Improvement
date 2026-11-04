import Link from "next/link";

import { format } from "@/lib/i18n/format";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
import { FREE_ARTICLES } from "@/lib/plans/features";
import type { SectionProps } from "../types";
import { FinalCtaForm } from "./final-cta-form";
import styles from "./final-cta.module.css";

/** The design's class names, through the module. */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * The closing banner (client's design, 2026-11-03: "the call to action
 * banner at the end is different"; <section class="rcta-wrap"
 * id="repget-final-cta">), ported as drawn: the dark box with the sign-up
 * field and the two ways to start on the left, what RepGet covers on the
 * right.
 *
 * The field submits as the hero's does (FinalCtaForm). "Check my website for
 * free" is the free check (/audit, no account needed); "Create {n} Articles
 * for Free" is sign-up, where {n} is FREE_ARTICLES - the number the account
 * really gets.
 */
export function FinalCta({ locale, href }: SectionProps) {
  const t = finalCtaCopy(locale);
  const n = { n: FREE_ARTICLES };

  return (
    <section className={c("rcta-wrap")} id="repget-final-cta" aria-labelledby="rcta-heading">
      <div className={c("rcta-box")}>
        <div className={c("rcta-pattern")} aria-hidden="true" />
        <div className={c("rcta-inner")}>
          <div className={c("rcta-kicker")}>{t.kicker}</div>
          <h2 id="rcta-heading">
            {t.titleLead} <em>{t.titleAccent}</em>
          </h2>
          <p className={c("rcta-desc")}>{t.desc}</p>
          <FinalCtaForm strings={t.form} signUpPath={href("/sign-up")} onboardingPath={href("/onboarding/website")} />
          <div className={c("rcta-quick-actions")} aria-label={t.quickLabel}>
            <Link className={c("rcta-quick-btn rcta-quick-primary")} href={href("/audit")}>
              {t.checkFree} <span aria-hidden="true">→</span>
            </Link>
            <Link className={c("rcta-quick-btn rcta-quick-secondary")} href={href("/sign-up")}>
              {format(t.createFree, n)} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className={c("rcta-bottom")}>
            {t.points.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </div>
        <div className={c("rcta-side")}>
          <div className={c("rcta-pills")}>
            {t.pills.map((pill) => (
              <span key={pill}>{pill}</span>
            ))}
          </div>
          <div className={c("rcta-panel")}>
            <div className={c("rcta-panel-head")}>
              <strong>{t.panelTitle}</strong>
              <small>{t.panelBody}</small>
            </div>
            <ul className={c("rcta-mini-list")}>
              {t.items.map((item) => (
                <li key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className={c("rcta-side-note")}>{t.sideNote}</div>
        </div>
      </div>
    </section>
  );
}
