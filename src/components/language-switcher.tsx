"use client";

import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { usePostVersions } from "@/components/post-languages";
import { buttonVariants } from "@/components/ui/button";
import { discoverPath } from "@/lib/discover/paths";
import { LOCALE_NAMES, localePath, LOCALES, splitLocale, TRANSLATED_PATHS, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Language switcher.
 *
 * Keeps the reader on the page they are already on rather than sending them to
 * the translated homepage — someone reading about pricing in English wants
 * pricing in Spanish, not the front page.
 *
 * Only the pages that exist in every language (TRANSLATED_PATHS in
 * lib/i18n/config.ts) are switchable. A page with no translation would 404
 * in the other language, which is worse than not offering the switch, so the
 * list is explicit.
 *
 * BLOG POSTS TOO (client, 2026-11-05: English articles had no switcher), where
 * every language's address is its own. A language with a PUBLISHED translation
 * leads to that same article (components/post-languages.tsx). Any other leads
 * to that language's blog, which always exists, and says so: never a made-up
 * address, a draft, or another article. Before the page has said which
 * translations exist (no script, or not yet) each language is offered as its
 * blog, which is true whichever it turns out to be. Canonical and hreflang are
 * the page's own (app/(marketing)/blog/post-view.tsx) and do not depend on this.
 *
 * A native disclosure (<details>) rather than the Radix dropdown it used to
 * be: that brought a positioning engine, focus management and a scroll lock -
 * about 20 KB compressed - into every public page's first download, for a
 * footer control with five links. The links are also in the HTML now, where
 * a crawler finds them, instead of appearing only when the menu opens.
 *
 * `label` is the button's screen-reader name in the page's language (from
 * lib/i18n/site-chrome.ts; never messages.ts here). Each language's name is
 * written in that language, so its link says so with lang.
 */

/** "/blog/<slug>": a post's page. Not /blog itself, nor /blog/category/..., which have more parts. */
const POST_PATH = /^\/blog\/(?!category$|author$|sponsorship$)[^/]+$/;

/** "/discover/<slug>": a business profile. Same address in every language (an untranslated one shows the English story). */
const PROFILE_PATH = /^\/discover\/([^/]+)$/;

/** A language's blog, and that an article is not in it - each in that language, as the link's name is. */
const BLOG_FALLBACK: Record<Locale, { blog: string; missing: string }> = {
  en: { blog: "Blog in English", missing: "This article is not available in English" },
  es: { blog: "Blog en español", missing: "Este artículo no está disponible en español" },
  fr: { blog: "Blog en français", missing: "Cet article n’est pas disponible en français" },
  it: { blog: "Blog in italiano", missing: "Questo articolo non è disponibile in italiano" },
  de: { blog: "Blog auf Deutsch", missing: "Dieser Artikel ist nicht auf Deutsch verfügbar" },
};

/**
 * `appearance` restyles it for the public footer's design (globe, the
 * language's name and a small chevron, components/marketing-nav.tsx): the
 * classes replace the button look, and `icon`/`chevron` the globe and add
 * the chevron. The behaviour is unchanged.
 */
export function LanguageSwitcher({
  label,
  appearance,
}: {
  label: string;
  appearance?: { details?: string; summary: string; name?: string; icon: ReactNode; chevron?: ReactNode };
}) {
  const pathname = usePathname();
  const { locale, path } = splitLocale(pathname);
  const menu = useRef<HTMLDetailsElement>(null);
  const isPost = POST_PATH.test(path);
  const profile = PROFILE_PATH.exec(path)?.[1];
  const versions = usePostVersions(pathname);

  /*
    A disclosure closes only from its own summary; these make it behave like
    the menu it looks like. A click elsewhere closes it, and Escape closes it
    and hands focus back to the button.
  */
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const details = menu.current;
      if (details?.open && !details.contains(event.target as Node)) {
        details.open = false;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      const details = menu.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Nothing to switch to on a page that only exists in English.
  if (!TRANSLATED_PATHS.has(path) && !profile && !isPost) return null;

  return (
    <details ref={menu} className={cn("group relative", appearance?.details)}>
      {/* group-open: the highlight the button had while its menu was open. */}
      <summary
        aria-label={label}
        className={
          appearance
            ? cn("cursor-pointer list-none [&::-webkit-details-marker]:hidden", appearance.summary)
            : cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "cursor-pointer list-none gap-1.5 group-open:bg-muted group-open:text-foreground [&::-webkit-details-marker]:hidden",
              )
        }
      >
        {appearance ? appearance.icon : <Globe className="size-4" aria-hidden="true" />}
        <span className={appearance ? appearance.name : "hidden sm:inline"}>{LOCALE_NAMES[locale]}</span>
        {appearance?.chevron}
      </summary>

      {/* Opens upwards: it sits at the very bottom of the page. On a post its wider words wrap inside the screen. */}
      <ul className={cn("absolute bottom-full left-0 z-50 mb-1 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10", isPost && "w-max max-w-[min(20rem,calc(100vw-2rem))]")}>
        {LOCALES.map((option) => {
          // On a post: this article (the language being read, or a published translation), or that language's blog.
          const article = profile
            ? discoverPath(option, profile)
            : !isPost
              ? localePath(option, path)
              : option === locale
                ? pathname
                : versions?.[option];
          return (
            <li key={option}>
              <Link
                href={article ?? localePath(option, "/blog")}
                // Tells a crawler which language this link leads to, which is
                // what makes a switcher useful for indexing rather than only
                // for people.
                hrefLang={option}
                // "Español" is Spanish whatever the page's language.
                lang={option}
                aria-current={option === locale ? "true" : undefined}
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                }}
                className={cn(
                  "flex flex-col rounded-md px-1.5 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                  option === locale && "font-medium",
                )}
              >
                {article ? LOCALE_NAMES[option] : BLOG_FALLBACK[option].blog}
                {!article && versions ? <span className="text-xs text-muted-foreground">{BLOG_FALLBACK[option].missing}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
