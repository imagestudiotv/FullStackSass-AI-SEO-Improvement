import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { partnerViewer, type PartnerAccess } from "@/lib/partners/presentation/guards";

/**
 * What every portal page starts with: who is looking (re-checked here, per
 * page - not inherited from the layout) and their language.
 */
export const portalContext = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/partner");
  const [viewer, { locale }] = await Promise.all([partnerViewer(), getAppMessages(session.user.id)]);
  return { viewer, locale, copy: partnerCopy(locale) };
});

/** A portal page that needs a partner profile; anyone else is sent to apply. */
export async function requirePartnerPage(): Promise<{ access: PartnerAccess } & Awaited<ReturnType<typeof portalContext>>> {
  const context = await portalContext();
  if (context.viewer.state !== "partner") redirect("/partner/apply");
  return { ...context, access: context.viewer.access };
}

/** Localised country names, for the payout-country choice. */
export function countryNames(codes: string[], locale: string): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null;
  }
  return codes
    .map((code) => ({ code, name: names?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** ?page=3 -> 3; anything else -> 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 && page < 100_000 ? page : 1;
}
