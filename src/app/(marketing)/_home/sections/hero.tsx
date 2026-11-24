import { Fragment, type CSSProperties } from "react";

import { WEBSITE_CREATION_PATH } from "@/lib/config/site";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
import { heroCopy } from "@/lib/i18n/home/hero";
import { HeroForm } from "../hero-form";
import { SignalStreams } from "../signal-streams";
import { plain, rich } from "../text";
import type { SectionProps } from "../types";
import styles from "./hero.module.css";

/** The design's class names, hyphens and all, mapped to the module's. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

const TITLE_ID = "home-hero-title";

/**
 * The hero. Above the field, the client's headline (2026-11-24,
 * repget_homepage_animated_signals.html): a quiet opening line and the
 * promise - ONE heading - and a description of two lines. From both sides,
 * the signal streams run into the field (_home/signal-streams.tsx). The field
 * and everything after it are the 2026-11-03 design's (`rgx-hero`), unchanged.
 *
 * "Meet RepGet.", the title until then, is after the ribbon (meet.tsx).
 *
 * `data-stream-text` marks the lines of text the streams keep clear of.
 *
 * "Join with Google" starts Google's sign-in from here (_home/join-with-google.tsx).
 */
export function Hero({ locale, href }: SectionProps) {
  const t = heroCopy(locale).hero;
  const { emptyWebsite, emptyEmail } = finalCtaCopy(locale).form;
  // How long each of the title's lines is, for its size (hero.module.css).
  const chars = (text: string) => ({ "--line-chars": plain(text).length }) as CSSProperties;

  return (
    <section className={c("rgx-hero")} aria-labelledby={TITLE_ID}>
      <div className={c("rgx-hero-grid")} aria-hidden="true" />
      <div className={c("rgx-hero-haze")} aria-hidden="true" />
      <SignalStreams />

      <div className={c("rgx-hero-content")}>
        <h1 id={TITLE_ID} className={c("rgx-title")}>
          {/* The space keeps the two lines apart for a screen reader. */}
          <span className={c("rgx-opening")} style={chars(t.opening)} data-stream-text="">
            {/* A phone breaks the line between sentences, not inside one. */}
            {t.opening.split(/(?<=\.) /).map((sentence, index) => (
              <Fragment key={sentence}>
                {index > 0 ? " " : null}
                <span>{sentence}</span>
              </Fragment>
            ))}
          </span>{" "}
          <span className={c("rgx-promise")} style={chars(t.promise)} data-stream-text="">
            {rich(t.promise)}
          </span>
        </h1>
        <p className={c("rgx-description")}>
          <span data-stream-text="">{rich(t.descriptionLead)}</span> <span data-stream-text="">{t.descriptionRest}</span>
        </p>

        <HeroForm
          strings={{
            websiteLabel: t.websiteLabel,
            emailLabel: t.emailLabel,
            websitePlaceholder: t.websitePlaceholder,
            emailPlaceholder: t.emailPlaceholder,
            startTrial: t.startTrial,
            useEmail: t.useEmail,
            useWebsite: t.useWebsite,
            invalidWebsite: t.invalidWebsite,
            invalidEmail: t.invalidEmail,
            moreWays: t.moreWays,
            noWebsite: t.noWebsite,
            buildOne: t.buildOne,
            emptyWebsite,
            emptyEmail,
          }}
          signUpPath={href("/sign-up")}
          onboardingPath={href("/onboarding/website")}
          planPath={href("/growth-plan")}
          buildPath={href(WEBSITE_CREATION_PATH)}
          googleLabel={t.joinGoogle}
          googleIcon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285f4" d="M21.3 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.2c-.2 1.1-.9 2.1-1.9 2.9v2.5h3.2c1.8-1.7 2.8-4.2 2.8-7.2z" />
              <path fill="#34a853" d="M12 21.5c2.6 0 4.9-.9 6.5-2.4l-3.2-2.4c-.9.6-2 .9-3.3.9-2.6 0-4.8-1.8-5.6-4.1H3.2V16A9.8 9.8 0 0 0 12 21.5z" />
              <path fill="#fbbc05" d="M6.4 13.5a6 6 0 0 1 0-4V7H3.2a9.8 9.8 0 0 0 0 9z" />
              <path fill="#ea4335" d="M12 5.9c1.4 0 2.7.5 3.7 1.5l2.9-2.9A9.5 9.5 0 0 0 12 2a9.9 9.9 0 0 0-8.8 5l3.2 2.5C7.2 7.2 9.4 5.9 12 5.9z" />
            </svg>
          }
          benefits={
            <ul className={c("rgx-benefits")}>
              {t.benefits.map((item) => (
                <li key={item}>
                  <i aria-hidden="true">✓</i>
                  {item}
                </li>
              ))}
            </ul>
          }
          watch={
            /* Scrolls to the walkthrough; the video starts from its own section, never from here. */
            <a className={c("rgx-watch")} href="#repget-demo-video">
              <span className={c("rgx-play-icon")} aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 4.5v11l8-5.5-8-5.5Z" />
                </svg>
              </span>
              <span>{t.seeHow}</span>
            </a>
          }
        />
      </div>
    </section>
  );
}
