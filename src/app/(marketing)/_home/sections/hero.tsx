import { ChartLine, Check, FileText, Link2, MessageCircle, Play, Search, Sparkles, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BrandIcon, type BrandIconName } from "@/components/brand-icons";
import { GoogleMark } from "@/components/google-mark";
import { initials } from "@/components/testimonial-card";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { HeroForm } from "../hero-form";
import { HeroParallax } from "../hero-parallax";
import styles from "../home.module.css";
import { rich } from "../text";
import type { SectionProps } from "../types";

const TITLE_ID = "home-hero-title";

/**
 * The six floating cards, in the order of `c.hero.cards`: social, SEO, AI,
 * backlinks, content, insights.
 *
 * The icon clouds are the design's, minus what RepGet does not connect to:
 * LinkedIn and Google Business Profile become platforms we do publish to or
 * read from, and the "DR" / "GPT" text chips become the real marks (see
 * components/brand-icons.tsx). Only the first two of each show below 1200px.
 */
const CARDS: { className: string; icon: LucideIcon; cloud: BrandIconName[] }[] = [
  { className: styles.cardSocial, icon: MessageCircle, cloud: ["instagram", "tiktok", "facebook", "x"] },
  { className: styles.cardSeo, icon: Search, cloud: ["google", "searchconsole", "analytics", "globe"] },
  { className: styles.cardAi, icon: Sparkles, cloud: ["chatgpt", "gemini", "perplexity", "spark"] },
  { className: styles.cardLinks, icon: Link2, cloud: ["link", "globe", "file", "analytics"] },
  { className: styles.cardContent, icon: FileText, cloud: ["file", "youtube", "pinterest", "wordpress"] },
  { className: styles.cardInsights, icon: ChartLine, cloud: ["analytics", "spark", "brain", "searchconsole"] },
];

/** How many reviewer faces the pill shows. */
const PILL_AVATARS = 3;

/**
 * The hero (client's design, 2026-11-03): the promise, the website field,
 * and six cards for what RepGet does floating around them.
 *
 * What the design had and this does not, on purpose:
 *  - The "★★★★★ 4.9/5" rating. There is no public review score
 *    (lib/marketing/testimonials.ts), so the pill shows the faces of
 *    PUBLISHED reviewers and links to their words - and is not drawn at all
 *    until one is published.
 *  - The cards' "+200% organic clicks", "90+ posts a month" and so on: not
 *    measured. They say what each part of the product does instead.
 *  - "Don't have a website? We'll build one for you": there is no such
 *    service to link to.
 *
 * The Google button goes to sign-up, as the old hero's did, rather than
 * starting OAuth here: that page offers Google and email, so changing one's
 * mind does not strand anyone.
 */
export function Hero({ c, m, href, testimonials }: SectionProps & { testimonials: Testimonial[] }) {
  const t = c.hero;
  // Faces first: initials are the fallback, not the point of the pill.
  const reviewers = [...testimonials].sort((a, b) => Number(Boolean(b.avatar)) - Number(Boolean(a.avatar))).slice(0, PILL_AVATARS);

  return (
    <HeroParallax className={styles.hero} labelledBy={TITLE_ID}>
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroHaze} aria-hidden="true" />

      <div className={styles.heroContent}>
        <p className={styles.heroEyebrow}>
          <span className={styles.spark} aria-hidden="true">
            ✳
          </span>
          {t.eyebrow}
        </p>

        {reviewers.length > 0 ? (
          <a className={styles.reviewsPill} href="#repget-reviews">
            {/* The names are in the reviews themselves; here the faces are decoration. */}
            <span className={styles.avatars} aria-hidden="true">
              {reviewers.map((person, index) => (
                <span key={`${index}-${person.name}`} className={styles.avatar}>
                  {initials(person.name)}
                  {person.avatar ? <Image src={person.avatar} alt="" width={30} height={30} unoptimized /> : null}
                </span>
              ))}
            </span>
            {t.reviewsLink}
          </a>
        ) : null}

        <h1 id={TITLE_ID} className={styles.title}>
          <span>{rich(t.titleLine1)}</span> <span>{rich(t.titleLine2)}</span>
        </h1>
        <p className={styles.description}>{rich(t.description)}</p>

        <HeroForm
          strings={{
            websiteLabel: t.websiteLabel,
            emailLabel: t.emailLabel,
            emailPlaceholder: t.emailPlaceholder,
            startTrial: t.startTrial,
            useEmail: t.useEmail,
            useWebsite: t.useWebsite,
            invalidWebsite: t.invalidWebsite,
            invalidEmail: t.invalidEmail,
          }}
          websiteExamples={[t.websitePlaceholder]}
          signUpPath={href("/sign-up")}
          onboardingPath={href("/onboarding/website")}
        />

        <ul className={styles.benefits}>
          {m.home.heroAssurances.map((item) => (
            <li key={item}>
              <Check aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <div className={styles.heroActions}>
          <Link className={styles.googleButton} href={href("/sign-up")}>
            <GoogleMark />
            {m.home.joinGoogle}
          </Link>
          {/* Scrolls to the walkthrough; the video starts from its own section, never from here. */}
          <a className={styles.watch} href="#repget-demo-video">
            <span className={styles.playIcon} aria-hidden="true">
              <Play fill="currentColor" />
            </span>
            {m.home.seeHow}
          </a>
        </div>
      </div>

      {/*
        After the content in the page, so a screen reader meets the headline
        and the field first; the stylesheet floats them around it on a wide
        screen and lines them up underneath below 1200px.
      */}
      <div className={styles.cards}>
        {CARDS.map((card, index) => {
          const copy = t.cards[index];
          if (!copy) return null;
          const Icon = card.icon;
          return (
            <div key={copy.title} className={`${styles.card} ${card.className}`}>
              <div className={styles.cardInner}>
                <span className={styles.cardTitle}>
                  <Icon aria-hidden="true" />
                  {copy.title}
                </span>
                <span className={styles.cardDetail}>{copy.detail}</span>
              </div>
              <div className={styles.cloud} aria-hidden="true">
                {card.cloud.map((name, i) => (
                  <span key={`${i}-${name}`} className={styles[`b-${name}`]}>
                    <BrandIcon name={name} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </HeroParallax>
  );
}
