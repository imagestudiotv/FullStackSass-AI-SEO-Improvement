import { Bot, ExternalLink, ImageIcon, Megaphone, Newspaper, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBlogCategoriesAdmin, listBlogPostsAdmin } from "@/lib/admin/blog";
import { placementsToReview } from "@/lib/admin/blog-sponsorships";
import { BLOG_LOCALES, blogPath, isBlogLocale, LANGUAGE_NAMES, LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { categoryText } from "@/lib/blog/shared";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { ExpandableText } from "../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar } from "../_ui/toolbar";
import { AddLanguage } from "./add-language";
import { BlogCategories } from "./blog-categories";
import { adminBlogPath, newBlogPostPath } from "./languages";
import { postStatus } from "./post-status";

export const dynamic = "force-dynamic";

type Params = { lang?: string | string[]; q?: string | string[]; category?: string | string[] };

/** One value of a query parameter: a repeated one (?q=a&q=b) is read as its first, as the toolbar reads it. */
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const languageOf = (params: Params): Locale => {
  const lang = first(params.lang);
  return isBlogLocale(lang) ? lang : DEFAULT_LOCALE;
};
/** The category filter's "no filter": nothing a category's address can be (blogSlug makes letters, digits and dashes). */
const ALL_CATEGORIES = "*";

/** The tab's language in the title too, so switching tabs is announced as a new page. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const language = languageOf(await searchParams);
  return { title: language === DEFAULT_LOCALE ? "Blog" : `Blog (${LANGUAGE_NAMES_EN[language]})` };
}

const n = (value: number) => formatNumber(value, "en");
const day = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** Day and time in UTC, the way the rest of the admin panel shows times. */
const when = (date: Date) =>
  `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

/**
 * RepGet's own blog, one language at a time (client, 2026-10-15: "add
 * separate language tabs: English | Italian | ... so I can access the blogs
 * from all languages at once because once will be many will create
 * confusing"). A tab for each language with posts; the chosen language's
 * posts, drafts included, with a search and a category filter; and the
 * blog's categories, which every language shares. A published post is public
 * at once; drafts are visible only here.
 */
export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const language = languageOf(params);
  const term = (first(params.q) ?? "").trim().slice(0, 100);
  const [posts, categories, toReview] = await Promise.all([listBlogPostsAdmin(), listBlogCategoriesAdmin(), placementsToReview()]);

  const counts = Object.fromEntries(BLOG_LOCALES.map((locale) => [locale, posts.filter((post) => post.locale === locale).length])) as Record<Locale, number>;
  // English, each language with a post, and the one shown; the others wait under "Add language".
  const tabs = BLOG_LOCALES.filter((locale) => locale === DEFAULT_LOCALE || locale === language || counts[locale] > 0);
  const addable = BLOG_LOCALES.filter((locale) => !tabs.includes(locale));

  const ofLanguage = posts.filter((post) => post.locale === language);
  const live = ofLanguage.filter((post) => post.status === "published").length;
  /*
    A post keeps its category by the English name; the filter goes by the
    category's address, the same in every language. One that no longer exists
    (an old link, a category deleted since) matches nothing, so the page says
    so and offers to clear it, rather than showing every post under its chip.
  */
  const wanted = first(params.category);
  const filteringCategory = Boolean(wanted) && wanted !== ALL_CATEGORIES;
  const category = filteringCategory ? (categories.find((entry) => entry.slug === wanted) ?? null) : null;
  const needle = term.toLowerCase();
  const rows = ofLanguage.filter(
    (post) =>
      (!filteringCategory || (category !== null && post.category === category.name)) &&
      (!needle || [post.title, post.slug].some((text) => text.toLowerCase().includes(needle))),
  );
  /**
   * A category under its name in the language shown, as that language's
   * readers see it, marked with that language - or the English name, where
   * it has none in the language, marked as English (the page's own).
   */
  const categoryLabel = (name: string) => {
    const entry = categories.find((candidate) => candidate.name === name);
    const shown = entry ? categoryText(entry, language).name : name;
    return <span lang={shown !== name ? language : undefined}>{shown}</span>;
  };
  const languageName = LANGUAGE_NAMES_EN[language];
  const english = language === DEFAULT_LOCALE;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Blog"
        description="RepGet's own blog, one language at a time: each language has its own posts and drafts. A published post is live at once."
        actions={
          <>
            {/* Paid "Get Featured" requests (lib/blog/sponsorship.ts), with how many wait for a decision. */}
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/blog/sponsorships">
                <Megaphone aria-hidden="true" />
                Featured placements
                {toReview > 0 ? (
                  <span className="rounded-full bg-warning-soft px-1.5 text-xs font-semibold text-warning tabular-nums">
                    {n(toReview)}
                    <span className="sr-only"> to review</span>
                  </span>
                ) : null}
              </Link>
            </Button>
            {/* Every uploaded picture, with the posts that use it (lib/admin/blog-images.ts). */}
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/blog/images">
                <ImageIcon aria-hidden="true" />
                Images
              </Link>
            </Button>
            {/* The daily article, its languages and its topic list (lib/blog/autopilot). */}
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/blog/autopilot">
                <Bot aria-hidden="true" />
                Autopilot
              </Link>
            </Button>
            {/* In the language shown, and says so. */}
            <Button asChild size="lg">
              <Link href={newBlogPostPath(language)}>
                <Plus aria-hidden="true" />
                {english ? "New post" : `New ${languageName} post`}
              </Link>
            </Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 pt-3 sm:px-5">
          <p id="blog-language" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Blog language
          </p>
          <p className="text-xs text-muted-foreground">Posts and drafts stay within the selected language</p>
        </div>
        {/*
          Five languages at most, so on a narrow screen the tabs wrap onto a
          second line rather than scroll: every tab stays in view, the chosen
          one included, and nothing clips a tab's focus ring.
        */}
        <div className="flex flex-wrap items-center gap-x-2 px-2 sm:px-3">
          <nav aria-labelledby="blog-language" className="flex flex-wrap">
            {tabs.map((locale) => {
              const active = locale === language;
              return (
                <Link
                  key={locale}
                  href={adminBlogPath(locale)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pt-2 pb-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "rounded px-1 py-px font-mono text-[0.65rem] font-semibold uppercase",
                      active ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {locale}
                  </span>
                  <span lang={locale}>{LANGUAGE_NAMES[locale]}</span>
                  {/* Solid on the chosen tab: orange text on a pale orange is too faint at this size. */}
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {n(counts[locale])}
                    <span className="sr-only"> {counts[locale] === 1 ? "post" : "posts"}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
          {addable.length > 0 ? <AddLanguage languages={addable} /> : null}
        </div>
      </div>

      <section aria-labelledby="posts-title" className="space-y-3">
        <ListHeading
          id="posts-title"
          title={`${languageName} posts`}
          description="Most recently edited first. Drafts are visible only here."
          count={`${n(ofLanguage.length)} ${ofLanguage.length === 1 ? "post" : "posts"} · ${n(live)} published`}
        />
        {ofLanguage.length > 0 ? (
          <AdminToolbar
            searchPlaceholder="Search posts in this language"
            filters={[
              {
                param: "category",
                label: "Category",
                allValue: ALL_CATEGORIES,
                options: [
                  { value: ALL_CATEGORIES, label: "All categories" },
                  ...categories.map((entry) => ({ value: entry.slug, label: categoryText(entry, language).name })),
                ],
              },
            ]}
            keep={["lang"]}
            resultLabel={needle || filteringCategory ? `${n(rows.length)} matching` : undefined}
          />
        ) : null}
        <AdminTableCard>
          {ofLanguage.length === 0 ? (
            <AdminEmpty
              filtering={false}
              icon={Newspaper}
              noun="posts"
              title={`No ${languageName} posts yet`}
              description={
                english
                  ? "Press New post to write the first one."
                  : `Write the first one, or open an English post and choose Draft with AI or Copy under Translations to start a ${languageName} draft.`
              }
              action={
                <Button asChild variant="outline">
                  <Link href={newBlogPostPath(language)}>
                    <Plus aria-hidden="true" />
                    {english ? "New post" : `New ${languageName} post`}
                  </Link>
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <AdminEmpty filtering icon={Newspaper} noun="posts" title="No posts match" clearHref={adminBlogPath(language)} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">First published</TableHead>
                  <TableHead className="hidden sm:table-cell">Last edited</TableHead>
                  <TableHead className="hidden w-20 sm:table-cell">
                    <span className="sr-only">View</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((post) => {
                  const status = postStatus(post.status, Boolean(post.publishedAt));
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="min-w-40 whitespace-normal sm:min-w-52">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          // Read out in its own language, not the admin's English.
                          lang={english ? undefined : language}
                          className="rounded-sm font-medium underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {post.title}
                        </Link>
                        {/* A translation of an English post, and one still to be reviewed (lib/blog/locale.ts). */}
                        {post.translationOf || post.needsReview ? (
                          <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                            {post.translationOf ? <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Translation</span> : null}
                            {post.needsReview ? <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Needs review</span> : null}
                          </p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground wrap-anywhere">{blogPath(post.locale, post.slug)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{categoryLabel(post.category)}</p>
                        {post.status === "published" ? (
                          <a
                            href={blogPath(post.locale, post.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
                          >
                            View on the blog
                            <ExternalLink className="size-3" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{categoryLabel(post.category)}</TableCell>
                      <TableCell>
                        <AdminStatus tone={status.tone} label={status.label} icon={status.icon} title={status.title} />
                      </TableCell>
                      <TableCell className="hidden tabular-nums xl:table-cell">
                        {post.publishedAt ? (
                          <time dateTime={post.publishedAt.toISOString()}>{day(post.publishedAt)}</time>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="max-w-64">
                          <time dateTime={post.updatedAt.toISOString()} className="block tabular-nums">
                            {when(post.updatedAt)}
                          </time>
                          {post.updatedBy ? (
                            <ExpandableText text={post.updatedBy} threshold={28} className="text-xs text-muted-foreground" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {post.status === "published" ? (
                          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                            <a
                              href={blogPath(post.locale, post.slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View “${post.title}” on the blog (opens in a new tab)`}
                            >
                              View
                              <ExternalLink aria-hidden="true" />
                            </a>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </AdminTableCard>
      </section>

      <section id="categories" aria-labelledby="categories-title" className="scroll-mt-20 space-y-3">
        <ListHeading
          id="categories-title"
          title="Categories"
          description="Sections of the blog, each with its own page. Every language shares them, each under its own name (Edit -> In other languages). A category shows on a language's blog once it has a published post in that language. Post counts include drafts in every language; only a category no post uses can be deleted."
          count={`${n(categories.length)} ${categories.length === 1 ? "category" : "categories"}`}
        />
        <BlogCategories categories={categories} />
      </section>
    </AdminPage>
  );
}

/** A list's heading row: what it is, how it is ordered, and how many there are. */
function ListHeading({ id, title, description, count }: { id: string; title: string; description: ReactNode; count: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</p>
    </div>
  );
}
