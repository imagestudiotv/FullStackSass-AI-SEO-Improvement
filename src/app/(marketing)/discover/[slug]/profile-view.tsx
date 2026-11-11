import "server-only";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache, type ReactNode } from "react";

import { postEngagement, type PostEngagement } from "@/lib/blog/engagement";
import { jsonLdScript } from "@/lib/blog/shared";
import { discoverAlternates, discoverPath } from "@/lib/discover/paths";
import { monogram, websiteHost } from "@/lib/discover/profile-fields";
import { getDiscoverProfile, type DiscoverProfile } from "@/lib/discover/profiles";
import { COMMENTS_COPY } from "@/lib/i18n/blog-engagement";
import { localePath, type Locale } from "@/lib/i18n/config";
import { DISCOVER_COPY, fillDiscover } from "@/lib/i18n/discover";
import { SITE_OPEN_GRAPH } from "@/lib/seo/page-metadata";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";

import { ProfileShowcase } from "./profile-showcase";
import styles from "./profile.module.css";

/** One read per request for the page and its metadata. */
export const loadProfile = cache((locale: Locale, slug: string) => getDiscoverProfile(locale, slug));

/**
 * The story's upvotes and comments as everyone sees them (no viewer, no cookies: the page is the
 * same for every visitor; components/blog-engagement fetches the reader's own). A failed read
 * shows them empty rather than failing the page.
 */
export async function profileEngagement(postId: string): Promise<PostEngagement | null> {
  try {
    return await postEngagement(postId, null);
  } catch (error) {
    console.error("[discover] reading the profile's comments failed", error);
    return null;
  }
}

/** The profile's own address: its language's page, or the English one it falls back to. */
function canonicalPath(profile: DiscoverProfile): string {
  return discoverPath(profile.locale, profile.slug);
}

/** "<Name> | Discover on RepGet", its tagline, and its addresses in each language it exists in. */
export function profileMetadata(profile: DiscoverProfile, locale: Locale): Metadata {
  const copy = DISCOVER_COPY[locale].profile;
  const canonical = canonicalPath(profile);
  const languages = discoverAlternates(profile.slug, profile.locales);
  const description = (profile.tagline || profile.description).slice(0, 300);
  return {
    title: { absolute: fillDiscover(copy.metaTitle, { name: profile.name }) },
    description,
    alternates: languages ? { canonical, languages } : { canonical },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      images: profile.imageUrl ? [{ url: profile.imageUrl, alt: profile.imageAlt ?? profile.name }] : [SHARE_IMAGE],
      url: canonical,
    },
  };
}

const ARROW = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

/**
 * One business's page, /discover/<slug> (client's design, 2026-11-11 round
 * 2, repget_customer_showcase_centered.html): the breadcrumb, the chips, the
 * logo (or monogram), name, tagline and byline, the buttons, the showcase
 * picture (the story's featured image, or the design's block), the week's
 * stats, About, Who it's for, Main services, Business details, Growing with
 * RepGet (the customer story), the comments and "Get featured". The design's
 * preview header and footer are the site's; its "Design preview" note and
 * demo counts are not shipped - every figure is real.
 */
export function ProfileView({ profile, locale, initial }: { profile: DiscoverProfile; locale: Locale; initial: PostEngagement | null }) {
  const copy = DISCOVER_COPY[locale].profile;
  const path = discoverPath(locale, profile.slug);
  const shareUrl = `${siteUrl()}${canonicalPath(profile)}`;

  const host = profile.websiteUrl ? websiteHost(profile.websiteUrl) : null;
  const byline = [profile.location, profile.availability].filter((item): item is string => Boolean(item));
  const facts: { label: string; value: ReactNode }[] = [
    ...(profile.industry ? [{ label: copy.industry, value: profile.industry }] : []),
    ...(profile.location ? [{ label: copy.basedIn, value: profile.location }] : []),
    ...(profile.availability ? [{ label: copy.availableIn, value: profile.availability }] : []),
    {
      label: copy.website,
      value:
        profile.websiteUrl && host ? (
          <a className={styles.tinyLink} href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">
            {host} {ARROW}
          </a>
        ) : (
          <span className={styles.pendingWebsite}>{copy.websitePending}</span>
        ),
    },
  ];

  const structured = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: fillDiscover(copy.metaTitle, { name: profile.name }),
    url: shareUrl,
    inLanguage: profile.locale,
    about: {
      "@type": "Organization",
      name: profile.name,
      ...(profile.websiteUrl ? { url: profile.websiteUrl } : {}),
      description: profile.about[0] ?? profile.tagline,
      ...(profile.logoUrl ? { logo: profile.logoUrl } : {}),
      ...(profile.availability ? { areaServed: profile.availability } : {}),
      ...(profile.location ? { location: { "@type": "Place", name: profile.location } } : {}),
    },
    publisher: { "@type": "Organization", name: "RepGet", url: `${siteUrl()}/` },
  };

  const head = (
    <>
      <div className={styles.taxonomy} aria-label={copy.categoriesLabel}>
        {profile.tags.map((tag, index) => (
          <span key={index} className={styles.category}>
            {tag}
          </span>
        ))}
        <span className={styles.featured}>{copy.featured}</span>
      </div>
      <div className={styles.identity}>
        {profile.logoUrl ? (
          <div className={`${styles.brandMark} ${styles.brandLogo}`}>
            <Image src={profile.logoUrl} alt={fillDiscover(copy.logoLabel, { name: profile.name })} width={70} height={70} sizes="70px" />
          </div>
        ) : (
          <div className={styles.brandMark} role="img" aria-label={fillDiscover(copy.logoLabel, { name: profile.name })}>
            {monogram(profile.name)}
          </div>
        )}
        <div>
          <h1 className={styles.title}>{profile.name}</h1>
          <p className={styles.tagline}>{profile.tagline}</p>
          {byline.length > 0 || host ? (
            <div className={styles.byline}>
              {byline.map((item, index) => (
                <span key={index} className={styles.bylineItem}>
                  {index > 0 ? <span className={styles.dot} aria-hidden="true" /> : null}
                  <span>{item}</span>
                </span>
              ))}
              {profile.websiteUrl && host ? (
                <span className={styles.bylineItem}>
                  {byline.length > 0 ? <span className={styles.dot} aria-hidden="true" /> : null}
                  <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">
                    {host} <span aria-hidden="true">↗</span>
                  </a>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const visual = (
    <div className={styles.showcaseVisual}>
      {profile.imageUrl ? (
        <Image
          src={profile.imageUrl}
          alt={profile.imageAlt || fillDiscover(copy.photoLabel, { name: profile.name })}
          fill
          sizes="(max-width: 760px) calc(100vw - 36px), 740px"
          preload
          fetchPriority="high"
        />
      ) : (
        <div className={styles.placeholder} aria-hidden="true">
          <div className={styles.accent} />
          <strong>{profile.name}</strong>
          {profile.tags.length > 0 ? <span>{profile.tags.join(" · ")}</span> : null}
        </div>
      )}
    </div>
  );

  const sections = (
    <>
      <section className={styles.section} id="about" aria-labelledby="about-heading">
        <h2 id="about-heading">{copy.about}</h2>
        {profile.about.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </section>
      {profile.audience.length > 0 ? (
        <section className={styles.section} aria-labelledby="audience-heading">
          <h2 id="audience-heading">{copy.audience}</h2>
          {profile.audience.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ) : null}
      {profile.services.length > 0 ? (
        <section className={styles.section} aria-labelledby="services-heading">
          <h2 id="services-heading">{copy.services}</h2>
          <ul className={styles.services}>
            {profile.services.map((service, index) => (
              <li key={index}>{service}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={styles.section} aria-labelledby="details-heading">
        <h2 id="details-heading">{copy.details}</h2>
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.section} aria-labelledby="growth-heading">
        <h2 id="growth-heading">{copy.growth}</h2>
        <p>{fillDiscover(copy.growthText, { name: profile.name })}</p>
        <Link className={styles.tinyLink} href={profile.storyHref}>
          {copy.growthLink} {ARROW}
        </Link>
      </section>
    </>
  );

  const footer = (
    <div className={styles.featureFooter}>
      <span>{copy.featureText}</span>
      <Link href={localePath(locale, "/pricing")}>{copy.featureLink}</Link>
    </div>
  );

  return (
    <div className={styles.root}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <div className={styles.page}>
        <nav className={styles.breadcrumb} aria-label={copy.breadcrumbLabel}>
          <Link href={discoverPath(locale)}>{copy.businesses}</Link>
          <span className={styles.chev} aria-hidden="true">
            /
          </span>
          <span aria-current="page">{profile.name}</span>
        </nav>
        <ProfileShowcase
          locale={locale}
          copy={copy}
          commentsCopy={COMMENTS_COPY[locale]}
          postId={profile.postId}
          name={profile.name}
          websiteUrl={profile.websiteUrl}
          path={path}
          shareUrl={shareUrl}
          // Unread (a failed read): the totals the directory counted, and no comments listed.
          initial={initial ?? { postId: profile.postId, upvotes: profile.upvotes, upvoted: false, comments: [], signedIn: false }}
          commentTotal={profile.comments}
          upvotesWeek={profile.upvotesWeek}
          impressionsWeek={profile.impressionsWeek}
          head={head}
          visual={visual}
          sections={sections}
          footer={footer}
        />
      </div>
    </div>
  );
}
