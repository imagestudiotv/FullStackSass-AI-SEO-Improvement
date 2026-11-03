"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { splitLocale } from "@/lib/i18n/config";

/**
 * Keeps <html lang> on the page's language as the visitor moves between
 * pages without a reload. The first paint is LANG_SCRIPT's job
 * (lib/i18n/document-lang.ts); this covers the moves after it, both ways:
 * from / to /de it becomes "de", and back again "en".
 */
export function DocumentLang() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = splitLocale(pathname ?? "/").locale;
  }, [pathname]);
  return null;
}
