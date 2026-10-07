"use client";

import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { LOCALE_NAMES, localePath, LOCALES, splitLocale, TRANSLATED_PATHS } from "@/lib/i18n/config";
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
 * A native disclosure (<details>) rather than the Radix dropdown it used to
 * be: that brought a positioning engine, focus management and a scroll lock -
 * about 20 KB compressed - into every public page's first download, for a
 * footer control with five links. The links are also in the HTML now, where
 * a crawler finds them, instead of appearing only when the menu opens.
 */

export function LanguageSwitcher() {
  const pathname = usePathname();
  const { locale, path } = splitLocale(pathname);
  const menu = useRef<HTMLDetailsElement>(null);

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
  if (!TRANSLATED_PATHS.has(path)) return null;

  return (
    <details ref={menu} className="group relative">
      {/* group-open: the highlight the button had while its menu was open. */}
      <summary
        aria-label="Change language"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "cursor-pointer list-none gap-1.5 group-open:bg-muted group-open:text-foreground [&::-webkit-details-marker]:hidden",
        )}
      >
        <Globe className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{LOCALE_NAMES[locale]}</span>
      </summary>

      {/* Opens upwards: it sits at the very bottom of the page. */}
      <ul className="absolute bottom-full left-0 z-50 mb-1 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
        {LOCALES.map((option) => (
          <li key={option}>
            <Link
              href={localePath(option, path)}
              // Tells a crawler which language this link leads to, which is
              // what makes a switcher useful for indexing rather than only
              // for people.
              hrefLang={option}
              aria-current={option === locale ? "true" : undefined}
              onClick={() => {
                if (menu.current) menu.current.open = false;
              }}
              className={cn(
                "flex rounded-md px-1.5 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                option === locale && "font-medium",
              )}
            >
              {LOCALE_NAMES[option]}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
