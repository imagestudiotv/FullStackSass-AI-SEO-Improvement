"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGUAGE_NAMES } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";

import { adminBlogPath } from "./languages";

/**
 * "+ Add language" beside the language tabs: the site's languages that have
 * no post yet. Choosing one opens its tab, empty, with a button to write the
 * first post in it. The languages are the site's own (lib/i18n/config.ts);
 * a new one needs the whole site translated, not only a tab.
 */
export function AddLanguage({ languages }: { languages: readonly Locale[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="my-1.5 shrink-0 border-dashed bg-transparent text-muted-foreground">
          <Plus aria-hidden="true" />
          Add language
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-64">
        {/* Nothing is saved by choosing: the tab stays once the language has a post. */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Opens the language&apos;s tab. It stays once a post is saved in it.
        </DropdownMenuLabel>
        {languages.map((locale) => (
          <DropdownMenuItem key={locale} asChild>
            <Link href={adminBlogPath(locale)}>
              <span aria-hidden="true" className="rounded bg-muted px-1 py-px font-mono text-[0.65rem] font-semibold uppercase">
                {locale}
              </span>
              <span lang={locale}>{LANGUAGE_NAMES[locale]}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
