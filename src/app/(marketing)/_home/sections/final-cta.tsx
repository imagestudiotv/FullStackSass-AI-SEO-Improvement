import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
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
 * The closing banner (client's design cta.html, 2026-11-11), ported as
 * drawn: the dark box with the two ways to start and one field on the left,
 * what RepGet covers on the right.
 *
 * It replaces the 2026-11-03 banner, whose field and buttons looked the same
 * as the hero's. The visitor picks "Check my website" (the free check, /audit)
 * or "Start free trial" (sign-up) first; FinalCtaForm sends the field there.
 *
 * The blog's pages end with it too (blog/post-view.tsx and the lists).
 */
export function FinalCta({ locale, href }: SectionProps) {
  const t = finalCtaCopy(locale);

  return (
    <section className={c("rcta-wrap")} id="repget-final-cta" aria-labelledby="rcta-heading">
      <div className={c("rcta-box")}>
        <div className={c("rcta-main")}>
          <p className={c("rcta-kicker")}>{t.kicker}</p>
          <h2 id="rcta-heading">
            {t.titleLead} <em>{t.titleAccent}</em>
          </h2>
          <p className={c("rcta-desc")}>{t.desc}</p>
          <FinalCtaForm
            strings={t.form}
            paths={{ auditPath: href("/audit"), signUpPath: href("/sign-up"), onboardingPath: href("/onboarding/website") }}
          />
          <ul className={c("rcta-trust")}>
            {t.points.map((point) => (
              <li key={point}>
                <span aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className={c("rcta-side")}>
          <ul className={c("rcta-pills")}>
            {t.pills.map((pill) => (
              <li key={pill}>{pill}</li>
            ))}
          </ul>
          <div className={c("rcta-card")}>
            <h3>{t.panelTitle}</h3>
            <p className={c("rcta-card-intro")}>{t.panelBody}</p>
            <ul className={c("rcta-benefits")}>
              {t.items.map((item) => (
                <li key={item.title}>
                  <span className={c("rcta-check")} aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className={c("rcta-side-note")}>{t.sideNote}</p>
        </div>
      </div>
    </section>
  );
}
