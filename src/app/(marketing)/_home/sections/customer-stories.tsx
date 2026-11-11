import Image from "next/image";
import Link from "next/link";

import { businessInitial } from "@/lib/blog/business";
import { CUSTOMER_STORIES_COPY } from "@/lib/i18n/blog-engagement";
import type { Locale } from "@/lib/i18n/config";

import styles from "./customer-stories.module.css";

/** One story as the section shows it (lib/blog/engagement.ts listCustomerStories). */
export type HomeCustomerStory = {
  postId: string;
  title: string;
  description: string;
  /** The business's name; the post's author when none is given. */
  name: string;
  logoUrl: string | null;
  href: string;
};

const fill = (template: string, name: string) => template.replace("{name}", name);

const ARROW = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

/**
 * Customer stories (client, 2026-11-11): the latest three published posts in
 * the blog's Customer stories category, in the visitor's language (or the
 * English ones while it has none), right after the guest Growth Copilot.
 * Nothing at all when there are none. The design's three hand-drawn sample
 * stories are not shipped: every story here is a real post.
 */
export function CustomerStories({
  locale,
  stories,
  viewAllHref,
}: {
  locale: Locale;
  stories: HomeCustomerStory[];
  /** The category's page in the visitor's language. */
  viewAllHref: string;
}) {
  if (stories.length === 0) return null;
  const t = CUSTOMER_STORIES_COPY[locale];
  return (
    <section id="repget-customer-stories" className={styles.section} aria-labelledby="repget-stories-heading">
      <div className={styles.inner}>
        <header>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h2 id="repget-stories-heading">{t.heading}</h2>
          <div className={styles.introRow}>
            <p className={styles.intro}>{t.intro}</p>
            <Link href={viewAllHref} className={styles.seeAll}>
              {t.viewAll} {ARROW}
            </Link>
          </div>
        </header>
        <div className={styles.separator} aria-hidden="true" />
        <div className={styles.stories}>
          {stories.slice(0, 3).map((story) => (
            <article key={story.postId} className={styles.story}>
              <div className={styles.logoWrap}>
                <div className={styles.logo}>
                  {story.logoUrl ? (
                    <Image src={story.logoUrl} alt={fill(t.logoLabel, story.name)} width={55} height={55} sizes="55px" />
                  ) : (
                    <span className={styles.initial} role="img" aria-label={fill(t.logoLabel, story.name)}>
                      {businessInitial(story.name)}
                    </span>
                  )}
                </div>
                <span className={styles.featured} title={t.featured} role="img" aria-label={t.featured}>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M2 6.2l4.3 3.1L10 3.7l3.7 5.6L18 6.2l-1.4 9.4H3.4L2 6.2z" />
                  </svg>
                </span>
              </div>
              <div className={styles.copy}>
                <div className={styles.titleRow}>
                  <h3>
                    <Link href={story.href}>{story.title}</Link>
                  </h3>
                  <Link className={styles.arrow} href={story.href} aria-label={fill(t.openStory, story.name)}>
                    {ARROW}
                  </Link>
                </div>
                <p className={styles.description}>{story.description}</p>
                <p className={styles.byline}>
                  {story.name} <b>·</b> {t.byline}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
