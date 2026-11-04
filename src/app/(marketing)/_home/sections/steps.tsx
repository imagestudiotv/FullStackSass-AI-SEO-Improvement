import { storyCopy } from "@/lib/i18n/home/story";

import type { SectionProps } from "../types";

import styles from "./steps.module.css";

/** Maps the design's class names to this module's, so the markup reads like the design. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/**
 * "Be ready before your next coffee." - the three steps to start, ported from
 * the client's approved design (design.html, section `rgx-start`, 2026-11-04).
 *
 * The section carries `data-reveal`: the page's RevealRoot (one
 * IntersectionObserver for the page) marks it `data-shown` once it scrolls
 * in, which is the design's `is-visible` - the progress line grows and the
 * number tiles change colour as the design's cascade gives (steps.module.css).
 *
 * The id is the one the header's "How it works" links to (/#how-it-works);
 * the design's own id, `rgx-how`, is on the inner wrapper. "Start free trial"
 * goes back up to the hero's form, as the design's `#top` does: `#top` is
 * the top of the page even with no element of that id.
 */
export function Steps({ locale }: SectionProps) {
  const t = storyCopy(locale).steps;
  const drawings = [<Website key="site" t={t} />, <Plan key="plan" t={t} />, <Connect key="connect" t={t} />];

  return (
    <section id="how-it-works" className={c("rgx-start")} aria-labelledby="rgx-start-title" data-reveal>
      <div className={c("rgx-start-inner")} id="rgx-how">
        <header className={c("rgx-start-heading")}>
          <span className={c("rgx-start-kicker")}>{t.kicker}</span>
          <h2 id="rgx-start-title">
            {t.title} <span>{t.titleAccent}</span>
          </h2>
          <p>{t.sub}</p>
        </header>
        <div className={c("rgx-start-track")}>
          {/* First, as in the design: the steps' colours are set by position (:nth-child). */}
          <span className={c("rgx-start-progress")} aria-hidden="true" />
          {t.items.map((step, i) => (
            <article key={step.title} className={c("rgx-start-step")}>
              <span className={c("rgx-start-index")} aria-hidden="true">
                {i + 1}
              </span>
              <div className={c("rgx-start-graphic")} aria-hidden="true">
                {drawings[i]}
              </div>
              <h3>
                <span className={c("sr-only")}>
                  {t.step} {i + 1}:{" "}
                </span>
                {step.title}
              </h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <div className={c("rgx-start-bottom")}>
          <a className={c("rgx-start-cta")} href="#top">
            {t.cta} <span aria-hidden="true">↗</span>
          </a>
          <span className={c("rgx-start-footnote")}>{t.footnote}</span>
        </div>
      </div>
    </section>
  );
}

type Copy = ReturnType<typeof storyCopy>["steps"];

function Website({ t }: { t: Copy }) {
  return (
    <div className={c("rgx-start-browser")}>
      <div className={c("rgx-start-browser-top")}>
        <i />
        <i />
        <i />
      </div>
      <div className={c("rgx-start-url")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c-5.5 4.5-5.5 13.5 0 18M12 3c5.5 4.5 5.5 13.5 0 18" />
        </svg>
        <span>{t.url}</span>
        <b />
      </div>
      <div className={c("rgx-start-email")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        {t.emailInstead}
      </div>
    </div>
  );
}

function Plan({ t }: { t: Copy }) {
  return (
    <div className={c("rgx-start-plan")}>
      <div className={c("rgx-start-plan-label")}>{t.planLabel}</div>
      {t.plans.map((plan, i) => (
        <div key={plan.name} className={c(i === 1 ? "rgx-start-plan-item active" : "rgx-start-plan-item")}>
          <i>{i === 1 ? "✓" : null}</i>
          {plan.name}
          <small>{plan.tag}</small>
        </div>
      ))}
    </div>
  );
}

function Connect({ t }: { t: Copy }) {
  return (
    <div className={c("rgx-start-connect")}>
      <div className={c("rgx-start-connect-window")}>
        <div className={c("rgx-start-connect-top")}>{t.setupLabel}</div>
        <div className={c("rgx-start-connect-main")}>
          <span className={c("rgx-start-connect-mark")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
              <path d="M10 14 14 10M8 16H6a4 4 0 0 1 0-8h4m4 0h4a4 4 0 0 1 0 8h-4" />
            </svg>
          </span>
          <div>
            <strong>{t.yourWebsite}</strong>
            <small>{t.connectReview}</small>
          </div>
        </div>
        <div className={c("rgx-start-ready")}>
          <i />
          {t.ready}
        </div>
      </div>
      <div className={c("rgx-start-connect-bubble")}>✓ {t.connected}</div>
    </div>
  );
}
