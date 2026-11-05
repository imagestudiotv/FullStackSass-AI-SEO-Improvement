import { ArrowRight, Check, Files, Lock, Share2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { ACCOUNT_AUDIT_MAX_PAGES, PUBLIC_AUDIT_MAX_PAGES } from "@/lib/audit/limits";
import { auditEndingCopy } from "@/lib/i18n/audit-ending";
import { localePath, type Locale } from "@/lib/i18n/config";

import { signUpWithWebsite } from "../_home/start-field";
import styles from "./audit-ending.module.css";
import { AUDIT_COPY } from "./copy";
import { plural } from "./plural";

/** The copy's **bold** runs (lib/i18n/audit-ending.ts). */
function Bold({ text }: { text: string }) {
  return text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>));
}

/**
 * How the free audit's report ends (client's design, 2026-11-05,
 * RepGet_Audit_End_Only.html): the white "see the full picture" panel, then
 * the dark closing banner. These replace the report's old gate and join block.
 *
 * Both sign-up buttons carry the audited website through sign-up to the website
 * step, so the visitor does not type it twice. The offer, the price and the
 * page limits are all read from where they are enforced, and the count of what
 * this free check did not list is the old gate's real number.
 */
export function AuditEnding({
  domain,
  hiddenIssues,
  offer,
  locale,
}: {
  domain: string;
  hiddenIssues: number;
  offer: { price: string | null; freeArticles: number };
  locale: Locale;
}) {
  const t = auditEndingCopy(locale);
  const report = AUDIT_COPY[locale].result;
  const signUp = signUpWithWebsite(localePath(locale, "/sign-up"), localePath(locale, "/onboarding/website"), domain);
  const pages = (text: string) =>
    text.replaceAll("{pages}", String(ACCOUNT_AUDIT_MAX_PAGES)).replaceAll("{freePages}", String(PUBLIC_AUDIT_MAX_PAGES));

  const unlocks = [
    { icon: Files, title: t.deeperAudit.title, body: pages(t.deeperAudit.body) },
    { icon: TrendingUp, title: plural(t.freeArticles.title, offer.freeArticles), body: t.freeArticles.body },
    { icon: Share2, title: t.withPlan.title, body: t.withPlan.body },
  ];

  return (
    <section className={styles.end} aria-label={t.label}>
      <div className={styles.upgrade}>
        <div className={styles.grid}>
          <div>
            <p className={styles.overline}>{t.overline}</p>
            <h2 className={styles.title}>{t.title}</h2>
            <p className={styles.copy}>
              <Bold text={pages(plural(t.body, offer.freeArticles))} />
            </p>
            {/* A real number from the real crawl, never an invented "47 issues found". */}
            {hiddenIssues > 0 ? (
              <p className={styles.hidden}>
                <Lock aria-hidden="true" />
                {plural(report.hidden, hiddenIssues)}
              </p>
            ) : null}
            <div className={styles.action}>
              <Link prefetch={false} className={styles.primary} href={signUp}>
                {t.cta}
                <ArrowRight aria-hidden="true" />
              </Link>
              <span className={styles.note}>
                <b>{plural(t.noteOffer, offer.freeArticles)}</b> · {t.noteTerms}
              </span>
            </div>
          </div>

          <div>
            <p className={styles.unlockHead}>
              <span>{t.unlockTitle}</span>
              <span>{t.unlockTag}</span>
            </p>
            <ul className={styles.unlocks}>
              {unlocks.map((item) => (
                <li key={item.title} className={styles.unlock}>
                  <span className={styles.unlockIcon} aria-hidden="true">
                    <item.icon />
                  </span>
                  <div>
                    <p className={styles.unlockTitle}>{item.title}</p>
                    <p className={styles.unlockBody}>{item.body}</p>
                  </div>
                  <Check className={styles.unlockCheck} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.final}>
        <div className={styles.finalContent}>
          <p className={styles.finalEyebrow}>{t.finalEyebrow}</p>
          <h2 className={styles.finalTitle}>
            {t.finalTitle[0]}
            <br />
            {t.finalTitle[1]}
          </h2>
          <p className={styles.finalBody}>
            {t.finalBody}
            {offer.price ? ` ${report.plansStart.replace("{price}", offer.price).trim()}` : ""}
          </p>
        </div>
        <div className={styles.finalButtons}>
          <Link prefetch={false} className={styles.finalPrimary} href={signUp}>
            {plural(t.finalCta, offer.freeArticles)}
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link prefetch={false} className={styles.finalSecondary} href={localePath(locale, "/pricing")}>
            {report.seePricing}
          </Link>
        </div>
      </div>
    </section>
  );
}
