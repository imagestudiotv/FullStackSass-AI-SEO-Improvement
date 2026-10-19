import "server-only";

import type { Locale } from "@/lib/i18n/config";

import { partnerDeps } from "../server";
import { partnerCopy } from "./copy";

/**
 * The account-menu label for the partner portal, for a user who owns a
 * partner profile; null for everyone else, and on any failure (the menu
 * must never break the app shell).
 */
export async function partnerPortalLink(userId: string, locale: Locale): Promise<string | null> {
  try {
    const partner = await partnerDeps().uow.repositories.partners.findByUserId(userId);
    return partner ? partnerCopy(locale).portal.title : null;
  } catch (error) {
    console.error("[partners] could not read the partner profile for the menu", error);
    return null;
  }
}
