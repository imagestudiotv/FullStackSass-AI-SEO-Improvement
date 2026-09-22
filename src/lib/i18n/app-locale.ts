import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { getMessages, type Messages } from "@/lib/i18n/messages";

/**
 * Which language to render the signed-in app in.
 *
 * The marketing site carries its locale in the URL (/es/pricing), which the
 * app cannot do: its routes are not duplicated per language, and prefixing
 * them would break every existing link and bookmark. So the app reads the
 * preference off the account instead — one value, followed everywhere, set
 * from Settings.
 *
 * Resolution order, and why:
 *
 *  1. The stored preference. An explicit choice always wins.
 *  2. Accept-Language, when nothing is stored. Someone whose browser is in
 *     German should not have to find the dropdown before the app speaks to
 *     them, and this is only ever a first guess — the moment they choose,
 *     step 1 takes over permanently.
 *  3. English.
 *
 * Deliberately NOT cached across requests: the preference changes from the
 * Settings form, and a cached value would leave the old language on screen
 * until the process restarted.
 */
export async function resolveAppLocale(userId: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // A stored value we no longer ship degrades rather than throwing.
  if (row?.locale && isLocale(row.locale)) return row.locale;

  return (await localeFromRequest()) ?? DEFAULT_LOCALE;
}

/**
 * The best-matching locale from the browser's Accept-Language header.
 *
 * Parsed by hand rather than with a library: the header is a comma-separated
 * list of tags with optional q-weights, already in the browser's preference
 * order, and we only need the first one we actually ship. Region subtags are
 * dropped — we ship "es", not "es-MX", and a Mexican reader wants Spanish.
 */
async function localeFromRequest(): Promise<Locale | null> {
  let header: string | null = null;
  try {
    header = (await headers()).get("accept-language");
  } catch {
    // Called outside a request scope. Fall through to the default.
    return null;
  }
  if (!header) return null;

  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    // A malformed q reads as 0 rather than NaN, which would sort unpredictably.
    .map((entry) => ({ ...entry, q: Number.isFinite(entry.q) ? entry.q : 0 }))
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/** The dictionary for a user, ready to hand to a component tree. */
export async function getAppMessages(userId: string): Promise<{
  locale: Locale;
  t: Messages;
}> {
  const locale = await resolveAppLocale(userId);
  return { locale, t: getMessages(locale) };
}
