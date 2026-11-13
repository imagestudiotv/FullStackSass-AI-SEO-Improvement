import { ImageIcon } from "lucide-react";
import Link from "next/link";

import { listBlogImages, type BlogImage } from "@/lib/admin/blog-images";
import { BLOG_LOCALES, isBlogLocale, LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { ImageCardActions, UploadBlogImage } from "./image-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog images" };

const n = (value: number) => formatNumber(value, "en");

function size(bytes: number | null): string {
  if (bytes === null) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const unused = (image: BlogImage) => image.usedIn.length === 0;
const inLanguage = (language: Locale | null) => (image: BlogImage) => language === null || image.languages.includes(language);
/** "an Italian post", "a Spanish post". */
const aOrAn = (name: string) => (/^[AEIOU]/.test(name) ? "an" : "a");

/** A row of filters as links, each with how many pictures it shows. */
function FilterLinks({ label, options }: { label: string; options: { label: string; count: number; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            option.active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
          )}
        >
          {option.label}
          <span className={cn("tabular-nums", option.active ? "text-background/75" : "text-muted-foreground")}>{n(option.count)}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Admin -> Blog -> Images: every picture uploaded for RepGet's blog
 * (lib/admin/blog-images.ts), newest first, with the posts that use it. A
 * picture no post uses can be deleted; one in use cannot. The post editor's
 * picker shows the same pictures, so one can be used again instead of
 * uploaded twice - those in the post's language (client, 2026-10-15), so
 * each picture shows its languages here, and the page can show one
 * language's. An upload is for the language chosen next to the button.
 */
export default async function BlogImagesPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; lang?: string }> }) {
  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const unusedOnly = params.show === "unused";
  const language = isBlogLocale(params.lang) ? params.lang : null;
  const { configured, images: all } = await listBlogImages(term);
  // Each filter's count is what choosing it would show, with the other filter kept.
  const ofLanguage = all.filter(inLanguage(language));
  const images = unusedOnly ? ofLanguage.filter(unused) : ofLanguage;
  const ofShow = unusedOnly ? all.filter(unused) : all;
  const query = (show: string | null, lang: Locale | null) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (show) p.set("show", show);
    if (lang) p.set("lang", lang);
    const s = p.toString();
    return s ? `/admin/blog/images?${s}` : "/admin/blog/images";
  };
  const show = unusedOnly ? "unused" : null;
  const languageName = language ? LANGUAGE_NAMES_EN[language] : null;

  return (
    <AdminPage>
      <AdminPageHeader
        back={{ href: "/admin/blog", label: "Blog" }}
        title="Images"
        description="Every picture uploaded for the blog, newest first, with its languages and the posts that use it. A picture no post uses can be deleted. In the post editor, the picture button offers the pictures in the post's language, or all of them."
        // Keyed by the language shown, so the upload's language follows it; none on "All languages".
        actions={configured ? <UploadBlogImage key={language ?? "all"} language={language} /> : null}
      />

      {!configured ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty filtering={false} icon={ImageIcon} noun="images" title="Image storage is not set up" description="Pictures can be listed once image storage is configured." />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <form action="/admin/blog/images" className="flex min-w-0 flex-1 gap-2">
              {unusedOnly ? <input type="hidden" name="show" value="unused" /> : null}
              {language ? <input type="hidden" name="lang" value={language} /> : null}
              <label htmlFor="blog-image-search" className="sr-only">
                Search pictures
              </label>
              <input
                id="blog-image-search"
                name="q"
                defaultValue={term}
                placeholder="Search by description, file name or post title"
                className="h-9 w-full max-w-md min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button type="submit" className="h-9 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted">
                Search
              </button>
            </form>
            <FilterLinks
              label="Which pictures"
              options={[
                { label: "All", count: ofLanguage.length, href: query(null, language), active: !unusedOnly },
                { label: "Not used", count: ofLanguage.filter(unused).length, href: query("unused", language), active: unusedOnly },
              ]}
            />
          </div>
          <FilterLinks
            label="Filter by language"
            options={[
              { label: "All languages", count: ofShow.length, href: query(show, null), active: language === null },
              ...BLOG_LOCALES.map((locale) => ({
                label: LANGUAGE_NAMES_EN[locale],
                count: ofShow.filter(inLanguage(locale)).length,
                href: query(show, locale),
                active: language === locale,
              })),
            ]}
          />

          {images.length === 0 ? (
            <div className="rounded-xl border bg-card">
              {/* With a search or "Not used", AdminEmpty says nothing matches; these are for an empty library or language. */}
              <AdminEmpty
                filtering={Boolean(term) || unusedOnly}
                icon={ImageIcon}
                noun="images"
                title={languageName ? `No ${languageName} pictures yet` : "No pictures yet"}
                description={
                  languageName
                    ? `Pictures appear here when they are uploaded in ${aOrAn(languageName)} ${languageName} post or here with ${languageName} chosen, or used in ${aOrAn(languageName)} ${languageName} post.`
                    : "Pictures appear here when you upload one, here or in the post editor."
                }
              />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((image) => (
                <li key={image.url} className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
                  <a href={image.url} target="_blank" rel="noopener noreferrer" className="block bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a stored file shown as is */}
                    <img src={image.url} alt={image.alt ?? ""} loading="lazy" className="aspect-video w-full object-contain" />
                    <span className="sr-only">Open the picture in a new tab</span>
                  </a>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 text-sm">
                    <p className={cn("line-clamp-2 wrap-anywhere", image.alt ? "" : "text-muted-foreground italic")}>
                      {image.alt ?? "No description"}
                    </p>
                    <p className="text-xs text-muted-foreground wrap-anywhere">
                      {image.name}
                      {image.size !== null ? ` · ${size(image.size)}` : ""}
                      {image.createdAt ? ` · ${formatDate(new Date(image.createdAt), "en", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </p>
                    {/* The languages whose posts are offered it (lib/admin/blog-images.ts). */}
                    <p className="flex flex-wrap gap-1.5 text-xs">
                      <span className="sr-only">Languages:</span>
                      {image.languages.length > 0 ? (
                        image.languages.map((locale) => (
                          <span key={locale} className="rounded-full bg-muted px-2 py-0.5 font-medium">
                            {LANGUAGE_NAMES_EN[locale]}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">No language</span>
                      )}
                    </p>
                    <div className="text-xs">
                      {image.usedIn.length === 0 ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Not used in any post</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Used in{" "}
                          {image.usedIn.map((post, index) => (
                            <span key={post.id}>
                              {index > 0 ? ", " : ""}
                              <Link href={`/admin/blog/${post.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                                {post.title}
                              </Link>
                              {post.status !== "published" ? " (draft)" : ""}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="mt-auto pt-2">
                      <ImageCardActions url={image.url} inUse={image.usedIn.length > 0} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminPage>
  );
}
