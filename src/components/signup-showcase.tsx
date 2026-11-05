import { CalendarDays, Check, Sparkles, TrendingUp } from "lucide-react";
import Image from "next/image";

import { BRAND_NAMES, BrandIcon, type BrandIconName } from "@/components/brand-icons";
import type { Locale } from "@/lib/i18n/config";
import { signupShowcaseCopy } from "@/lib/i18n/signup-showcase";

import styles from "./signup-showcase.module.css";

/**
 * The channels under the panel. The design also lists LinkedIn, which the
 * product does not connect to (lib/social/platforms.ts, lib/video/formats.ts),
 * so TikTok, which it does, takes that place.
 */
const CHANNELS: BrandIconName[] = ["google", "chatgpt", "gemini", "instagram", "tiktok", "youtube", "pinterest", "x"];

const ROW_ICONS = [TrendingUp, CalendarDays, Sparkles];

/**
 * The right-hand panel of the sign-up page (client's design, 2026-11-05,
 * RepGet-Signup-Official-Logo.html): one dark, unchanging panel, whichever
 * theme the page is in. Nothing rotates, so nothing shifts while someone is
 * typing.
 *
 * From lg it fills the column beside the form. Below that it comes after the
 * form in the document, so the form is still what a phone opens on and the
 * panel is only met by scrolling past it.
 */
export function SignUpShowcase({ locale }: { locale: Locale }) {
  const t = signupShowcaseCopy(locale);

  return (
    <section className={styles.cell} aria-labelledby="signup-showcase-title">
      <div className={styles.showcase}>
        <div className={styles.body}>
          <header className={styles.top}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h2 id="signup-showcase-title" className={styles.title}>
              {t.titleLead}
              <br />
              <span className={styles.accent}>{t.titleAccent}</span>
            </h2>
            <p className={styles.lead}>{t.lead}</p>
          </header>

          <div className={styles.panel}>
            <div className={styles.display} role="img" aria-label={t.previewLabel}>
              <div className={styles.glow} />
              <div className={styles.window}>
                <div className={styles.windowHeader}>
                  <span className={styles.windowLabel}>
                    <Image src="/images/repget-mark.png" alt="" width={14} height={14} className={styles.windowMark} />
                    {t.windowTitle}
                  </span>
                  <span className={styles.windowDots}>
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className={styles.chart}>
                  {[27, 48, 40, 62, 51, 72, 94].map((height) => (
                    <span key={height} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className={styles.rows}>
                  {t.windowRows.map(([name, status], index) => {
                    const Icon = ROW_ICONS[index];
                    return (
                      <div key={name} className={styles.row}>
                        <span className={styles.rowIcon}>
                          <Icon />
                        </span>
                        <span>{name}</span>
                        <strong>{status}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={styles.copy}>
              <p className={styles.kicker}>{t.kicker}</p>
              <h3 className={styles.panelTitle}>{t.panelTitle}</h3>
              <p className={styles.panelBody}>{t.panelBody}</p>
              <ul className={styles.features}>
                {t.features.map((feature) => (
                  <li key={feature}>
                    <span className={styles.featureCheck} aria-hidden="true">
                      <Check />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <footer className={styles.footer}>
            <p className={styles.caption}>{t.channelsCaption}</p>
            <ul className={styles.channels} aria-label={t.channelsLabel}>
              {CHANNELS.map((name) => (
                <li key={name}>
                  <BrandIcon name={name} className={styles.channelIcon} />
                  {BRAND_NAMES[name]}
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </div>
    </section>
  );
}
