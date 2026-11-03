import Link from "next/link";

import { BRAND_NAMES, BrandIcon, type BrandIconName } from "@/components/brand-icons";

import styles from "../home.module.css";
import type { SectionProps } from "../types";
import own from "./story.module.css";

/**
 * The design's strip, without the platforms the product does not connect to.
 * It drew LinkedIn (not supported, see components/brand-icons.tsx) and
 * unnamed "Blog" and "Website" tiles; WordPress stands for the website, as a
 * connection that exists.
 */
const STRIP: BrandIconName[] = [
  "threads",
  "pinterest",
  "bluesky",
  "youtube",
  "x",
  "searchconsole",
  "instagram",
  "tiktok",
  "facebook",
  "wordpress",
];

/**
 * Growth Copilot: the platforms it connects, then the dark card with what it
 * does and a conversation that plays out when the section scrolls in.
 *
 * The section carries `data-reveal`; the stylesheet brings in the visitor's
 * message, the status and the three results one after another once it has
 * `data-shown` (home.module.css, `.copilot[data-shown]`). Without JavaScript,
 * or with reduced motion, the whole conversation is simply there.
 *
 * The conversation is an illustration, not an account: hidden from screen
 * readers, who get the same promise from the heading and the three points.
 */
export function Copilot({ c, href }: SectionProps) {
  const t = c.copilot;

  return (
    <section id="repget-copilot" className={styles.copilot} data-reveal aria-labelledby="repget-copilot-title">
      <div className={styles.copilotShell}>
        <div className={`${styles.strip} ${styles.reveal}`} data-reveal>
          <p id="repget-copilot-strip">{t.strip}</p>
          <ul className={styles.stripIcons} aria-labelledby="repget-copilot-strip">
            {STRIP.map((name) => (
              <li key={name} className={styles[`b-${name}`]} title={BRAND_NAMES[name]}>
                <BrandIcon name={name} />
                <span className={styles.srOnly}>{BRAND_NAMES[name]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${styles.copilotCard} ${styles.reveal}`} data-reveal data-delay="1">
          <div className={styles.copilotCopy}>
            <span className={styles.kicker}>{t.kicker}</span>
            <h2 id="repget-copilot-title">{t.title}</h2>
            <p>{t.body}</p>
            <ul className={styles.copilotPoints}>
              {t.points.map((point) => (
                <li key={point.lead}>
                  <span>
                    <b>{point.lead}</b> {point.text}
                  </span>
                </li>
              ))}
            </ul>
            <div className={styles.copilotActions}>
              <Link href={href("/sign-up")} className={`${styles.orangeButton} ${own.focusRingLight}`}>
                {t.connect}
              </Link>
              <a href="#repget-demo-video" className={`${styles.outlineButton} ${own.focusRingLight}`}>
                {t.watch}
              </a>
            </div>
          </div>

          <div className={styles.chatVisual} aria-hidden="true">
            <div className={styles.chatGrid} />
            <div className={`${styles.mini} ${styles.miniLeft}`}>
              <BrandIcon name="globe" />
              {c.hero.websitePlaceholder}
            </div>
            <div className={`${styles.mini} ${styles.miniRight}`}>
              <BrandIcon name="instagram" />
              {t.channelsConnected}
            </div>
            <div className={styles.chatShell}>
              <div className={styles.chatUser}>{t.userMessage}</div>
              <div className={styles.chatStatus}>
                <i>✳</i>
                {t.status}
              </div>
              <ul className={styles.chatLines}>
                {t.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className={styles.chatInput}>{t.input}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
