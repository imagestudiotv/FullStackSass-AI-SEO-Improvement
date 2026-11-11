"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { safeNext } from "@/lib/auth/next";
import { togglePostUpvote } from "@/lib/blog/engagement-actions";
import { loadDiscoverViewer } from "@/lib/discover/actions";
import { discoverPath } from "@/lib/discover/paths";
import { monogram } from "@/lib/discover/profile-fields";
import { localePath, type Locale } from "@/lib/i18n/config";
import { businessCount, fillDiscover, type DiscoverDirectoryCopy } from "@/lib/i18n/discover";

import styles from "./discover.module.css";

/** One business as the directory lists it (lib/discover/profiles.ts DiscoverEntry). */
export type DirectoryEntry = {
  postId: string;
  slug: string;
  name: string;
  tagline: string;
  category: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  upvotes: number;
  comments: number;
  views: number;
  publishedAt: string;
};

type Sort = "votes" | "az";

const EYE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const COMMENT = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1.1L3 20.5l1.7-4.8A8.5 8.5 0 1 1 20.5 11.5Z" />
  </svg>
);
const VISIT = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const UP = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 4-7 8h4v8h6v-8h4l-7-8Z" />
  </svg>
);
const SEARCH = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="10.7" cy="10.7" r="7" />
    <path d="m16 16 5 5" />
  </svg>
);

/** The design's monogram tiles, one per business by its name (the same business always gets the same one). */
const TILES = [styles.tilePlain, styles.tileStudio, styles.tileGrow, styles.tileOxford, styles.tileCuliucs];
function tileOf(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return TILES[hash % TILES.length];
}

/** The logo (or the name's monogram) in the design's square tile. */
export function BusinessAvatar({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) {
    return (
      <span className={`${styles.avatar} ${styles.avatarLogo} ${className ?? ""}`} aria-hidden="true">
        <Image src={logoUrl} alt="" width={46} height={46} sizes="46px" />
      </span>
    );
  }
  return (
    <span className={`${styles.avatar} ${tileOf(name)} ${className ?? ""}`} aria-hidden="true">
      {monogram(name)}
    </span>
  );
}

/**
 * The customer directory (client's design, 2026-11-11 round 2,
 * repget_growth_businesses_brand_colors.html): every business growing with
 * RepGet, filtered by category, searched by name, tagline and category, and
 * sorted by upvotes or name - in the browser, over the list the page read
 * (it is short). Each row links to the business's profile, its comments and
 * its website, and upvotes it: a member's toggle (the story's own upvote,
 * one per member), a visitor goes to sign-in and back here.
 */
export function DiscoverDirectory({ locale, copy, entries }: { locale: Locale; copy: DiscoverDirectoryCopy; entries: DirectoryEntry[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("votes");
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(entries.map((entry) => [entry.postId, entry.upvotes])));
  const [upvoted, setUpvoted] = useState<Set<string>>(() => new Set());
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const loaded = useRef(false);

  const here = discoverPath(locale);
  const signInHref = `/sign-in?next=${encodeURIComponent(safeNext(here))}`;

  useEffect(() => {
    if (loaded.current || entries.length === 0) return;
    loaded.current = true;
    loadDiscoverViewer(entries.map((entry) => entry.postId))
      .then((viewer) => {
        setSignedIn(viewer.signedIn);
        setUpvoted(new Set(viewer.upvoted));
      })
      .catch(() => {
        // Upvoting still works: the action checks the session.
      });
  }, [entries]);

  // The industries that have a business, plus All.
  const categories = useMemo(
    () => [...new Set(entries.map((entry) => entry.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, locale)),
    [entries, locale],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const list = entries
      .map((entry) => ({ ...entry, upvotes: counts[entry.postId] ?? entry.upvotes }))
      .filter((entry) => (filter === null || entry.category === filter) && `${entry.name} ${entry.tagline} ${entry.category ?? ""}`.toLocaleLowerCase(locale).includes(needle));
    return list.sort((a, b) =>
      sort === "az" ? a.name.localeCompare(b.name, locale) : b.upvotes - a.upvotes || b.publishedAt.localeCompare(a.publishedAt),
    );
  }, [entries, counts, filter, query, sort, locale]);

  async function vote(entry: DirectoryEntry) {
    if (signedIn === false) return router.push(signInHref);
    const on = !upvoted.has(entry.postId);
    const set = (value: boolean, count?: number) => {
      setUpvoted((current) => {
        const next = new Set(current);
        if (value) next.add(entry.postId);
        else next.delete(entry.postId);
        return next;
      });
      setCounts((current) => ({ ...current, [entry.postId]: count ?? Math.max(0, (current[entry.postId] ?? 0) + (value ? 1 : -1)) }));
    };
    setBusy(entry.postId);
    set(on);
    try {
      const result = await togglePostUpvote(entry.postId, on);
      if (result.ok) set(result.data.upvoted, result.data.count);
      else if (result.error === "signed_out") {
        set(!on);
        router.push(signInHref);
      } else set(!on);
    } catch {
      set(!on);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.directory}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>
          {copy.titleLead}
          <span className={styles.brandWord}>{copy.titleBrand}</span>
        </h1>
        <p className={styles.subhead}>{copy.subhead}</p>

        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label={copy.filtersLabel}>
            {[null, ...categories].map((category) => (
              <button
                key={category ?? ""}
                type="button"
                className={styles.filter}
                aria-pressed={filter === category}
                onClick={() => setFilter(category)}
              >
                {category ?? copy.all}
              </button>
            ))}
          </div>
          <label className={styles.search} aria-label={copy.searchLabel}>
            {SEARCH}
            <input type="search" placeholder={copy.searchPlaceholder} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className={styles.listMeta}>
          <span aria-live="polite">{businessCount(copy, shown.length)}</span>
          <label className={styles.sort}>
            {copy.sortBy}{" "}
            <select aria-label={copy.sortLabel} value={sort} onChange={(event) => setSort(event.target.value === "az" ? "az" : "votes")}>
              <option value="votes">{copy.mostUpvoted}</option>
              <option value="az">{copy.nameAZ}</option>
            </select>
          </label>
        </div>

        <div className={styles.list}>
          {shown.length === 0 ? (
            <div className={styles.empty}>
              <strong>{copy.emptyTitle}</strong>
              {copy.emptyText}
            </div>
          ) : (
            shown.map((entry, index) => {
              const href = discoverPath(locale, entry.slug);
              const pressed = upvoted.has(entry.postId);
              const name = { name: entry.name };
              return (
                <article key={entry.postId} className={styles.entry}>
                  <span className={styles.rank}>{index + 1}</span>
                  <Link className={styles.avatarLink} href={href} aria-label={fillDiscover(copy.viewOn, name)}>
                    <BusinessAvatar name={entry.name} logoUrl={entry.logoUrl} />
                  </Link>
                  <div className={styles.info}>
                    <div className={styles.companyName}>
                      <Link href={href} aria-label={fillDiscover(copy.viewListing, name)}>
                        {entry.name}
                      </Link>
                    </div>
                    <p className={styles.tagline}>{entry.tagline}</p>
                  </div>
                  <div className={styles.entryActions} role="group" aria-label={fillDiscover(copy.rowActions, name)}>
                    <span className={styles.metric} title={copy.viewsTitle}>
                      {EYE}
                      <span aria-hidden="true">{entry.views}</span>
                      <span className="sr-only">{fillDiscover(copy.views, { n: entry.views })}</span>
                    </span>
                    <Link
                      className={`${styles.metric} ${styles.actionComment}`}
                      href={`${href}#comments`}
                      aria-label={fillDiscover(copy.comments, { n: entry.comments, name: entry.name })}
                      title={copy.commentsTitle}
                    >
                      {COMMENT}
                      <span>{entry.comments}</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.upvote}
                      title={fillDiscover(copy.upvoteTitle, name)}
                      aria-label={fillDiscover(pressed ? copy.removeUpvote : copy.upvote, name)}
                      aria-pressed={pressed}
                      disabled={busy === entry.postId}
                      onClick={() => vote(entry)}
                    >
                      {UP}
                      <span>{entry.upvotes}</span>
                    </button>
                    {entry.websiteUrl ? (
                      <a
                        className={styles.actionVisit}
                        href={entry.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={fillDiscover(copy.visitLabel, name)}
                        title={entry.websiteUrl}
                      >
                        {copy.visit} {VISIT}
                      </a>
                    ) : (
                      <span className={`${styles.actionVisit} ${styles.visitPending}`} title={copy.visitPending}>
                        {copy.visit} {VISIT}
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className={styles.bottomline}>
          <div>
            <strong>{copy.bottomTitle}</strong>
            {copy.bottomText}
          </div>
          <Link href={localePath(locale, "/pricing")}>{copy.bottomLink}</Link>
        </div>
      </div>
    </div>
  );
}
