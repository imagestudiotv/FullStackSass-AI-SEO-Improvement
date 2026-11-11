"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { localePath, splitLocale } from "@/lib/i18n/config";
import { BANNER_WORDS, countdownParts, type BannerCopy, type BannerTone, type LiveBanner } from "@/lib/promo-banner/banner";

import styles from "./promo-banner.module.css";

/**
 * The bar above the public site's header (client, 2026-11-11, after
 * nxgntools.com's): the administrator's offer, a countdown, and a link to
 * the pricing page - the whole bar is the link. Written in Admin -> Site
 * banner (lib/promo-banner/banner.ts for the rules).
 *
 * A client component for the same reason as the header: only the address
 * says which language the visitor reads (marketing-nav.tsx). The server sends
 * every language's words, already resolved.
 *
 * The countdown's numbers show "--" until the browser takes over, so the
 * prebuilt HTML (made hours earlier) never disagrees with the visitor's clock
 * and the bar keeps its size. When it reaches zero the bar goes away; the
 * server stops sending it once the end has passed.
 */
export function PromoBanner({ banner }: { banner: LiveBanner | null }) {
  const { locale } = splitLocale(usePathname());
  if (!banner) return null;
  const words = banner.copy[locale];
  return (
    <PromoBannerView
      tone={banner.tone}
      endsAt={banner.endsAt}
      words={words}
      units={BANNER_WORDS[words.lang].units}
      href={localePath(locale, "/pricing")}
      // English words on a /de page are read as English.
      lang={words.lang === locale ? undefined : words.lang}
    />
  );
}

/** The bar itself; also the admin form's preview, which passes no link and keeps it at zero. */
export function PromoBannerView({
  tone,
  endsAt,
  words,
  units,
  href,
  hideWhenOver = true,
  lang,
}: {
  tone: BannerTone;
  endsAt: string | null;
  words: BannerCopy;
  units: readonly [string, string, string, string];
  /** null: a plain bar, not a link (the preview). */
  href: string | null;
  hideWhenOver?: boolean;
  /** The words' language, when it is not the page's. */
  lang?: string;
}) {
  const parsed = endsAt ? Date.parse(endsAt) : NaN;
  const end = Number.isNaN(parsed) ? null : parsed;
  const now = useNow(end !== null);
  const left = end !== null && now !== null ? end - now : null;
  if (hideWhenOver && left !== null && left <= 0) return null;

  /*
    Two groups - the offer, then the countdown and the link - so a bar too
    long for one line breaks between them, never inside the countdown, and no
    separator is left hanging at the end of a line (the one between the
    groups shows on wide screens only, phones show none;
    promo-banner.module.css).
  */
  const content = (
    <span className={styles.inner}>
      <span className={styles.group}>
        {words.label ? <strong className={styles.label}>{words.label}</strong> : null}
        {words.label ? <Dot /> : null}
        <span>{words.message}</span>
      </span>
      <Dot between />
      <span className={`${styles.group} ${styles.action}`}>
        {end !== null ? (
          <>
            {/* Numbers that change every second are noise to a screen reader; the words say the offer. */}
            <span className={styles.count} aria-hidden="true">
              {units.map((unit, index) => {
                const value = left === null ? null : countdownParts(left)[index];
                return (
                  <Unit key={unit} value={value === null ? "--" : index === 0 ? String(value) : String(value).padStart(2, "0")} unit={unit} />
                );
              })}
            </span>
            <Dot />
          </>
        ) : null}
        <span className={styles.link}>{words.linkText}</span>
      </span>
    </span>
  );

  return href ? (
    <Link prefetch={false} href={href} className={styles.bar} data-tone={tone} lang={lang}>
      {content}
    </Link>
  ) : (
    <div className={styles.bar} data-tone={tone} lang={lang}>
      {content}
    </div>
  );
}

function Dot({ between = false }: { between?: boolean }) {
  return (
    <span className={between ? `${styles.dot} ${styles.between}` : styles.dot} aria-hidden="true">
      ·
    </span>
  );
}

function Unit({ value, unit }: { value: string; unit: string }) {
  return (
    <span className={styles.unit}>
      {value}
      <small>{unit}</small>
    </span>
  );
}

/** The time, every second, once in the browser; null on the server and before the first tick. */
function useNow(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  return active ? now : null;
}
