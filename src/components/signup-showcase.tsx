import Image from "next/image";

import type { Locale } from "@/lib/i18n/config";
import { signupShowcaseCopy } from "@/lib/i18n/signup-showcase";

import styles from "./signup-showcase.module.css";

/** The three signals around the mascots, with the design's marks. */
const NODES = [
  { mark: "⌕", className: styles.nodeSearch },
  { mark: "✦", className: styles.nodeAi },
  { mark: "↗", className: styles.nodeSocial },
];

/**
 * The right-hand panel of the sign-up page (client's design, 2026-11-15,
 * repget-signup-inline-owl.html: "replace the right panel only"). One dark
 * panel in both themes: the gecko waves, the owl stands with both wings open,
 * and three signals sit around them. Only the gecko's hand moves, so nothing
 * shifts while someone is typing; reduced motion stops it.
 *
 * From lg it fills the column beside the form. Below that it is not shown,
 * as in the design: on a phone the form is the page.
 */
export function SignUpShowcase({ locale }: { locale: Locale }) {
  const t = signupShowcaseCopy(locale);

  return (
    <section className={styles.cell} aria-labelledby="signup-showcase-title">
      <div className={styles.promo}>
        <header className={styles.top}>
          <p className={styles.kicker}>{t.kicker}</p>
          <h2 id="signup-showcase-title" className={styles.heading}>
            {t.titleLead}
            <em>{t.titleAccent}</em>
          </h2>
          <p className={styles.lead}>{t.lead}</p>
        </header>

        <div className={styles.scene} role="img" aria-label={t.sceneLabel}>
          <svg className={styles.connect} viewBox="0 0 720 440" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <linearGradient id="signup-showcase-line" x1="0" x2="1">
                <stop stopColor="#ee6e28" stopOpacity="0" />
                <stop offset=".5" stopColor="#ff9c52" stopOpacity=".82" />
                <stop offset="1" stopColor="#ff8c42" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M114 225c92-165 346-162 458-42" fill="none" stroke="url(#signup-showcase-line)" strokeWidth="2" />
            <path d="M173 311c140 102 363 58 435-71" fill="none" stroke="url(#signup-showcase-line)" strokeWidth="1.7" />
            <circle cx="205" cy="123" r="3.2" fill="#ff9347" />
            <circle cx="567" cy="260" r="3.5" fill="#ff9347" />
            <path d="M339 50l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#ff9959" opacity=".75" />
            <path d="M642 114l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ff9959" />
          </svg>
          <div className={`${styles.character} ${styles.gecko}`}>
            <Image className={styles.geckoPhoto} src="/images/signup/gecko-photo.webp" alt="" width={292} height={292} unoptimized />
            <Image className={styles.geckoHand} src="/images/signup/gecko-hand.webp" alt="" width={292} height={292} unoptimized />
          </div>
          <div className={`${styles.character} ${styles.owl}`}>
            <Image className={styles.owlPhoto} src="/images/signup/owl.webp" alt="" width={640} height={577} unoptimized />
          </div>
          {NODES.map((node, index) => (
            <div key={node.mark} className={`${styles.node} ${node.className}`}>
              <b aria-hidden="true">{node.mark}</b> {t.nodes[index]}
            </div>
          ))}
        </div>

        <footer className={styles.bottom}>
          <div className={styles.footLabel}>
            {t.footLead} <em>{t.footAccent}</em>
            <div className={styles.footNote}>{t.footNote}</div>
          </div>
          <div className={styles.footTag}>{t.tag}</div>
        </footer>
      </div>
    </section>
  );
}
