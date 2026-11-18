import "server-only";

import { getSession } from "@/lib/auth-guard";
import { resolveAppLocale } from "@/lib/i18n/app-locale";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * The language a server action answers in: the signed-in person's app
 * language (resolveAppLocale), the one the page that called it is rendered in.
 *
 * English when there is no session or the lookup fails. A refusal is the
 * answer the customer is waiting for, so a failed language lookup must never
 * take its place: it is logged and the refusal is said in English.
 */
export async function actionLocale(): Promise<Locale> {
  try {
    const session = await getSession();
    if (!session) return DEFAULT_LOCALE;
    return await resolveAppLocale(session.user.id);
  } catch (error) {
    console.warn("[i18n] could not read the app language; answering in English", error);
    return DEFAULT_LOCALE;
  }
}
