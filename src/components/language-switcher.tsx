"use client";

import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Button,
} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCALE_NAMES,
  LOCALES,
  localePath,
  splitLocale,
} from "@/lib/i18n/config";

/**
 * Language switcher.
 *
 * Keeps the reader on the page they are already on rather than sending them to
 * the translated homepage — someone reading about pricing in English wants
 * pricing in Spanish, not the front page.
 *
 * Only the pages that exist in every language are switchable. A page with no
 * translation would 404 in the other language, which is worse than not
 * offering the switch, so the list is explicit.
 */

/** Paths that exist in every locale. */
const TRANSLATED_PATHS = new Set(["/", "/pricing"]);

export function LanguageSwitcher() {
  const pathname = usePathname();
  const { locale, path } = splitLocale(pathname);

  // Nothing to switch to on a page that only exists in English.
  if (!TRANSLATED_PATHS.has(path)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Change language"
          className="gap-1.5"
        >
          <Globe className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{LOCALE_NAMES[locale]}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {LOCALES.map((option) => (
          <DropdownMenuItem key={option} asChild>
            <Link
              href={localePath(option, path)}
              // Tells a crawler which language this link leads to, which is
              // what makes a switcher useful for indexing rather than only
              // for people.
              hrefLang={option}
              className={option === locale ? "font-medium" : undefined}
            >
              {LOCALE_NAMES[option]}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
