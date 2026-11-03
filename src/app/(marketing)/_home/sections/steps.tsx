import { ArrowUpRight, Globe, Link2, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "../home.module.css";
import type { SectionProps } from "../types";
import own from "./story.module.css";

/**
 * From sign-up to setup: the three steps, each with a small drawing of what
 * the visitor will see.
 *
 * The section carries `data-reveal`, so when it scrolls in the track fills
 * and the step numbers light up one after the other (home.module.css,
 * `.steps[data-shown]`). The drawings are illustrations, hidden from screen
 * readers: each step's heading and text already say what they show.
 *
 * No form here: the call goes to sign-up, where the website-or-email choice
 * the steps describe is made.
 */
export function Steps({ c, href }: SectionProps) {
  const t = c.steps;
  const drawings = [<WebsiteDrawing key="site" c={c} />, <PlanDrawing key="plan" c={c} />, <ConnectDrawing key="connect" c={c} />];

  return (
    <section id="how-it-works" className={styles.steps} data-reveal aria-labelledby="repget-steps-title">
      <div className={styles.stepsInner}>
        <header className={`${styles.stepsHead} ${styles.reveal}`} data-reveal>
          <span className={styles.kicker}>{t.kicker}</span>
          <h2 id="repget-steps-title" className={styles.sectionTitle}>
            {t.title} <span>{t.titleAccent}</span>
          </h2>
          <p className={styles.sectionSub}>{t.sub}</p>
        </header>

        <ol className={styles.track}>
          {t.items.map((step, i) => (
            <li key={step.title} className={styles.step}>
              {/* The list already numbers the steps for a screen reader. */}
              <span className={styles.stepIndex} aria-hidden="true">
                {i + 1}
              </span>
              <div className={styles.stepGraphic} aria-hidden="true">
                {drawings[i] ?? null}
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
          {/*
            Last, not first: the stylesheet lights the steps up by position
            (:first-child, :nth-child), so nothing may come before them.
          */}
          <li className={styles.trackFill} aria-hidden="true" />
        </ol>

        <div className={styles.stepsBottom}>
          <Link href={href("/sign-up")} className={`${styles.darkButton} ${own.focusRing}`}>
            {t.cta}
            <span aria-hidden="true">
              <ArrowUpRight size={15} />
            </span>
          </Link>
          <span className={styles.footnote}>{t.footnote}</span>
        </div>
      </div>
    </section>
  );
}

function MockCard({ tilt, children }: { tilt?: "l" | "r"; children: ReactNode }) {
  const tiltClass = tilt === "l" ? styles.tiltL : tilt === "r" ? styles.tiltR : "";
  return <div className={`${styles.mockCard} ${tiltClass}`}>{children}</div>;
}

/** Step 1: a browser with a website being typed, and the email way in. */
function WebsiteDrawing({ c }: Pick<SectionProps, "c">) {
  return (
    <MockCard tilt="l">
      <div className={styles.browserDots}>
        <i />
        <i />
        <i />
      </div>
      <div className={styles.url}>
        <Globe strokeWidth={1.8} />
        <span>{c.hero.websitePlaceholder}</span>
        <b className={styles.caret} />
      </div>
      <div className={styles.mockNote}>
        <Mail size={13} strokeWidth={1.8} />
        {c.steps.emailInstead}
      </div>
    </MockCard>
  );
}

/**
 * Step 2: three plan rows, the middle one chosen. Bars rather than plan
 * names: the real names and what they include belong to pricing, and a
 * drawing that names plans would have to be kept in step with it.
 */
function PlanDrawing({ c }: Pick<SectionProps, "c">) {
  return (
    <MockCard>
      <p className={styles.mockLabel}>{c.steps.planLabel}</p>
      <div className={styles.planRow}>
        <i />
        <span className={own.planBar} />
      </div>
      <div className={`${styles.planRow} ${styles.planRowActive}`}>
        <i>✓</i>
        <span className={`${own.planBar} ${own.planBarActive}`} />
        <small>{c.steps.recommended}</small>
      </div>
      <div className={styles.planRow}>
        <i />
        <span className={own.planBar} />
      </div>
    </MockCard>
  );
}

/** Step 3: the website setup card, ready, with a "connected" bubble. */
function ConnectDrawing({ c }: Pick<SectionProps, "c">) {
  return (
    <>
      <MockCard tilt="r">
        <p className={styles.mockLabel}>{c.steps.setupLabel}</p>
        <div className={styles.connectMain}>
          <span className={styles.connectMark}>
            <Link2 strokeWidth={1.8} />
          </span>
          <div>
            <strong>{c.steps.yourWebsite}</strong>
            <small>{c.steps.connectReview}</small>
          </div>
        </div>
        <div className={styles.ready}>{c.steps.ready}</div>
      </MockCard>
      <span className={styles.bubble}>✓ {c.steps.connected}</span>
    </>
  );
}
