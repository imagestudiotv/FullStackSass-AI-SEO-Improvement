import type { CSSProperties } from "react";

import { WEBSITE_CREATION_PATH } from "@/lib/config/site";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
import { heroCopy } from "@/lib/i18n/home/hero";
import { HeroForm } from "../hero-form";
import { HeroMascot } from "../hero-mascot";
import { rich } from "../text";
import type { SectionProps } from "../types";
import styles from "./hero.module.css";

/** The design's class names, hyphens and all, mapped to the module's. */
const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

const TITLE_ID = "home-hero-title";

/** The brand in the title, the same in every language. */
const BRAND = "RepGet.";

/**
 * The hero. Above the field, the client's simpler version (2026-11-11,
 * repget_homepage_animated_social_proof.html): a pill, "Meet [the gecko and
 * the owl] RepGet.", the promise and the description. The field and
 * everything after it are the 2026-11-03 design's (`rgx-hero`), unchanged.
 *
 * "Meet RepGet." and the promise are ONE heading - the design makes the
 * promise an h2 under an h1 of only the name, which would leave the page's
 * main heading without what RepGet does. It looks the same either way.
 *
 * "Join with Google" starts Google's sign-in from here (_home/join-with-google.tsx).
 */
export function Hero({ locale, href }: SectionProps) {
  const t = heroCopy(locale).hero;
  const { emptyWebsite, emptyEmail } = finalCtaCopy(locale).form;
  // How long the title's line is, for its size (hero.module.css .rgx-name).
  const titleChars = { "--title-chars": t.meet.length + BRAND.length } as CSSProperties;

  return (
    <section className={c("rgx-hero")} aria-labelledby={TITLE_ID}>
      <div className={c("rgx-hero-grid")} aria-hidden="true" />
      <div className={c("rgx-hero-haze")} aria-hidden="true" />

      <div className={c("rgx-hero-content")}>
        <div className={c("rgx-pill")}>
          <span className={c("rgx-pill-mark")} aria-hidden="true">
            ✳
          </span>
          {t.pill}
        </div>

        <h1 id={TITLE_ID} className={c("rgx-title")}>
          {/* The spaces keep the heading's words apart for a screen reader; the line's layout ignores them. */}
          <span className={c("rgx-name")} style={titleChars}>
            <span>{t.meet}</span> <HeroMascot notes={t.mascotNotes} search={t.mascotSearch} />{" "}
            <span className={c("rgx-brand")}>{BRAND}</span>
          </span>{" "}
          <span className={c("rgx-subtitle")}>
            {t.subtitleLine1} <br />
            <em>{t.subtitleLine2}</em>
          </span>
        </h1>
        <p className={c("rgx-description")}>
          <span>{rich(t.descriptionLead)}</span> <span className={c("rgx-description-support")}>{t.descriptionRest}</span>
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
