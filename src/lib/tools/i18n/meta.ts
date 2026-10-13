import type { Locale } from "@/lib/i18n/config";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { TOOLS_COMMON } from "./common";

/** A tool page's metadata in a language: the registry's title, the page's description, hreflang. */
export function toolMetadata(href: string, locale: Locale, description: string) {
  return {
    title: TOOLS_COMMON[locale].tools[href]?.title ?? TOOLS_COMMON.en.tools[href].title,
    description,
    ...publicPageMetadata(href, { locale }),
  };
}

/** The `domain` query parameter, trimmed; "" when absent. */
export function domainParam(params: Record<string, string | string[] | undefined>): string {
  return typeof params.domain === "string" ? params.domain.trim() : "";
}
