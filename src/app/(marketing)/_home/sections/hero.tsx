import Image from "next/image";
import type { ReactElement } from "react";

import { WEBSITE_BUILD_TOPIC } from "@/lib/config/site";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
import { heroCopy } from "@/lib/i18n/home/hero";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { lettersOf, photoOf } from "../review-people";
import { HeroForm } from "../hero-form";
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

/** How many reviewer faces the pill shows. */
const PILL_AVATARS = 3;

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** The cards' own line icons, as drawn in the design. */
const CARD_ICONS: ReactElement[] = [
  <path key="social" d="M6 10.5c0-3.1 2.7-5.5 6-5.5s6 2.4 6 5.5c0 3.3-2.7 5.6-6 5.6H9l-3.5 2v-4.8c-.4-.8-.5-1.6-.5-2.8Z" />,
  <g key="seo">
    <circle cx="10.2" cy="10.2" r="6.3" />
    <path d="m15 15 5.5 5.5" />
  </g>,
  <path key="ai" d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" />,
  <path key="links" d="m10 14 4-4M8.5 16.5H6.8a4.4 4.4 0 0 1 0-8.8h3.7m3 0h3.7a4.4 4.4 0 0 1 0 8.8h-3.7" />,
  <g key="content">
    <rect x="5.5" y="3" width="13" height="18" rx="2.2" />
    <path d="M8.6 8.4h6.7M8.6 12h6.7M8.6 15.5h4.4" />
  </g>,
  <g key="insights">
    <path d="M4 19V5M4 19h16M7.5 15.6l4-4 3.4 1.5 4-5" />
    <path d="M15.8 8.1h3.1v3.1" />
  </g>,
];

/** The marks orbiting the cards (the design's `rgint-i-*` symbols). */
const MINI = {
  ig: (
    <>
      <rect fill="none" height="18" rx="5" stroke="currentColor" strokeWidth="2" width="18" x="3" y="3" />
      <circle cx="12" cy="12" fill="none" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.7" fill="currentColor" r="1.25" />
    </>
  ),
  linkedin: (
    <path
      d="M4.3 2.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM2.4 9h3.8v12.5H2.4zM8.5 9h3.6v1.7h.1a4.1 4.1 0 0 1 3.6-2c3.8 0 4.5 2.5 4.5 5.8v7h-3.8v-6.2c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2v6.3H8.5V9z"
      fill="currentColor"
    />
  ),
  tiktok: (
    <>
      <path d="M15 3.4c.4 2.7 2.2 4.4 5 4.8v3.5c-1.9-.1-3.6-.7-5-1.8v5.9a6.2 6.2 0 1 1-6.2-6.2v3.6a2.6 2.6 0 1 0 2.6 2.6V2h3.6v1.4Z" fill="currentColor" />
      <path d="M15 4.2v6m-5-1.1v4" fill="none" stroke="#fe2c55" strokeWidth=".8" />
    </>
  ),
  fb: <path d="M14.8 22V13h3l.5-4H14.8V6.6c0-1.2.4-2 2.2-2h1.5V1.1a21 21 0 0 0-2.5-.1C12 1 10 3.2 10 6.3V9H7v4h3v9h4.8Z" fill="currentColor" />,
  gsc: (
    <>
      <rect fill="none" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" width="16" x="4" y="4" />
      <path d="M7 16v-3l3-3 3 2 4-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </>
  ),
  analytics: (
    <>
      <rect fill="currentColor" height="8" rx="2" width="4" x="2.8" y="13" />
      <rect fill="currentColor" height="13" rx="2" width="4" x="9.6" y="8" />
      <rect fill="currentColor" height="18" rx="2" width="4" x="16.4" y="3" />
    </>
  ),
  gbp: (
    <>
      <path d="M3 11.5V20h18v-8.5" fill="none" stroke="#4285f4" strokeLinejoin="round" strokeWidth="2" />
      <path d="M5 3h14l2 7H3l2-7" fill="#4285f4" />
      <path d="M3 10h4.5c0 2.3-1 3.2-2.2 3.2S3 12.3 3 10Z" fill="#4285f4" />
      <path d="M7.5 10H12c0 2.3-1 3.2-2.3 3.2S7.5 12.3 7.5 10Z" fill="#ea4335" />
      <path d="M12 10h4.5c0 2.3-1 3.2-2.3 3.2S12 12.3 12 10Z" fill="#fbbc04" />
      <path d="M16.5 10H21c0 2.3-1 3.2-2.3 3.2s-2.2-.9-2.2-3.2Z" fill="#34a853" />
      <path d="M9 20v-5h6v5" fill="none" stroke="#4285f4" strokeWidth="1.4" />
    </>
  ),
  spark: (
    <path
      d="m12 1.5 1.8 6.7 6.7 1.8-6.7 1.8-1.8 6.7-1.8-6.7-6.7-1.8 6.7-1.8L12 1.5ZM19 16l.9 2.5 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9L19 16Z"
      fill="currentColor"
    />
  ),
  link: <path d="M10 7h-2a5 5 0 0 0 0 10h3m2-10h3a5 5 0 0 1 0 10h-2M8.5 12h7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />,
  globe: (
    <>
      <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c-5 5.5-5 12.5 0 18M12 3c5 5.5 5 12.5 0 18" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  file: (
    <>
      <rect fill="none" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" width="14" x="5" y="3" />
      <path d="M8 9h8m-8 4h8m-8 4h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </>
  ),
  youtube: <path d="m9 6.8 9 5.2-9 5.2V6.8Z" fill="currentColor" />,
  pinterest: (
    <path
      d="M12.3 2C6.5 2 3 6.2 3 11.1c0 3 1.3 5.4 3.8 6.4.4.1.7 0 .8-.4l.3-1.4c.1-.4 0-.5-.3-.9-.7-.8-1.2-1.9-1.2-3.4 0-4.3 3-7.6 7.2-7.6 3.6 0 5.6 2.2 5.6 5.2 0 3.9-1.7 7.1-4.1 7.1-1.4 0-2.4-1.2-2-2.7.4-1.8 1.3-3.8 1.3-5.1 0-1.2-.6-2.2-1.9-2.2-1.5 0-2.7 1.5-2.7 3.6 0 1.3.4 2.1.4 2.1L7.7 22h2.1l1.7-6.1c.6 1.1 2 2 3.7 2 4.9 0 8-4.5 8-9.1C23.2 4.9 19 2 12.3 2Z"
      fill="currentColor"
      transform="translate(1.1 0) scale(.91)"
    />
  ),
  brain: (
    <path
      d="M12 19V6a4 4 0 0 0-7.1-2.6A4 4 0 0 0 3 10a4 4 0 0 0 1 6.5 4 4 0 0 0 8 2.5Zm0 0V6a4 4 0 0 1 7.1-2.6A4 4 0 0 1 21 10a4 4 0 0 1-1 6.5 4 4 0 0 1-8 2.5Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  ),
} satisfies Record<string, ReactElement>;

type Mini = { mark: keyof typeof MINI } | { chip: string };

/** The six cards in the order of the copy's `cards`: the design's class, and the four marks around it. */
const CARDS: { name: string; cloud: Mini[] }[] = [
  { name: "social", cloud: [{ mark: "ig" }, { mark: "linkedin" }, { mark: "tiktok" }, { mark: "fb" }] },
  { name: "seo", cloud: [{ chip: "G" }, { mark: "gsc" }, { mark: "analytics" }, { mark: "gbp" }] },
  { name: "ai", cloud: [{ chip: "GPT" }, { chip: "Gem" }, { chip: "Px" }, { mark: "spark" }] },
  { name: "backlinks", cloud: [{ mark: "link" }, { mark: "globe" }, { chip: "DR" }, { mark: "analytics" }] },
  { name: "content", cloud: [{ mark: "file" }, { mark: "youtube" }, { mark: "pinterest" }, { mark: "linkedin" }] },
  { name: "insights", cloud: [{ mark: "analytics" }, { mark: "spark" }, { mark: "brain" }, { mark: "gsc" }] },
];

/**
 * The hero (client's design, 2026-11-03, `rgx-hero`): the promise, the
 * website field, and six cards for what RepGet does floating around them -
 * lined up in a scrolling rail under the field below 1200px.
 *
 * The rating pill carries the faces of PUBLISHED reviewers (Admin ->
 * Testimonials; initials until a photo loads) and links to their reviews
 * further down. With none published there is no reviews section to link
 * to, so the pill stands on its own, without faces.
 *
 * "Join with Google" starts Google's sign-in from here (_home/join-with-google.tsx).
 */
export function Hero({ locale, href, testimonials }: SectionProps & { testimonials: Testimonial[] }) {
  const t = heroCopy(locale).hero;
  const { emptyWebsite, emptyEmail } = finalCtaCopy(locale).form;
  // Faces first: initials are the fallback, not the point of the pill.
  const reviewers = [...testimonials].sort((a, b) => Number(Boolean(photoOf(b.avatar))) - Number(Boolean(photoOf(a.avatar)))).slice(0, PILL_AVATARS);

  const pill = (
    <>
      <span className={c("rgx-stars")} aria-hidden="true">
        ★★★★★
      </span>
      <strong>{t.ratingScore}</strong>
      <span className={c("rgx-rating-copy")}>{t.ratingCopy}</span>
      {reviewers.length > 0 ? (
        // The names are in the reviews themselves; here the faces are decoration.
        <span className={c("rgx-review-avatars")} aria-hidden="true">
          {reviewers.map((person, index) => (
            <span key={`${index}-${person.name}`} className={c("rgx-review-avatar")}>
              <span className={c("rgx-review-avatar-fallback")}>{lettersOf(person.name)}</span>
              {photoOf(person.avatar) ? <Image src={photoOf(person.avatar)!} alt="" width={32} height={32} unoptimized /> : null}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  return (
    <section className={c("rgx-hero")} aria-labelledby={TITLE_ID}>
      <div className={c("rgx-hero-grid")} aria-hidden="true" />
      <div className={c("rgx-hero-haze")} aria-hidden="true" />

      <div className={c("rgx-hero-content")}>
        <div className={c("rgx-eyebrow")}>
          <span className={c("rgx-spark")} aria-hidden="true">
            ✳
          </span>{" "}
          {t.eyebrow}
        </div>

        {reviewers.length > 0 ? (
          <a className={c("rgx-rating")} href="#repget-reviews" aria-label={t.ratingLabel}>
            {pill}
          </a>
        ) : (
          <span className={c("rgx-rating")}>{pill}</span>
        )}

        <h1 id={TITLE_ID} className={c("rgx-title")}>
          {rich(t.titleLine1)}
          <br />
          <span>{rich(t.titleLine2)}</span>
        </h1>
        <p className={c("rgx-description")}>
          {rich(t.descriptionLead)}
          <br className={c("rgx-wide-br")} /> {t.descriptionRest}
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
          buildPath={`${href("/contact")}?about=${WEBSITE_BUILD_TOPIC}`}
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
      {/*
        After the content in the page, so a screen reader meets the headline
        and the field first; the stylesheet floats the cards around it on a
        wide screen and lines them up underneath below 1200px.
      */}
      <div className={c("rgx-metric-field")} role="group" aria-label={t.cardsLabel}>
        {CARDS.map((card, index) => {
          const copy = t.cards[index];
          if (!copy) return null;
          return (
            <div key={card.name} className={c(`rgx-metric-card rgx-metric-${card.name}`)}>
              <div className={c("rgx-metric-copy")}>
                <div className={c("rgx-metric-title")}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" {...LINE}>
                    {CARD_ICONS[index]}
                  </svg>
                  <span>{copy.title}</span>
                </div>
                <div className={c("rgx-metric-row")}>
                  <strong>{copy.detail}</strong>
                </div>
              </div>
              <div className={c(`rgx-card-cloud rgx-card-cloud-${card.name}`)} aria-hidden="true">
                {card.cloud.map((item, i) =>
                  "chip" in item ? (
                    <span key={i} className={c("rgx-mini-chip")}>
                      {item.chip}
                    </span>
                  ) : (
                    <span key={i} className={c("rgx-mini-brand")}>
                      <svg viewBox="0 0 24 24">{MINI[item.mark]}</svg>
                    </span>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
