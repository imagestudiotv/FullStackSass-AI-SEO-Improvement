import { z } from "zod";

/**
 * Website projects: what the public page, the customer's screen and the
 * administrators' screen share. Plain values and types, so client components
 * can import it ("use server" files can only export async functions).
 *
 * THE FLOW (client, 2026-11-05: quote-based, no tariff). The customer sends a
 * brief -> an administrator agrees the scope and sets a price in credits -> the
 * customer accepts by paying from the ordinary credit wallet -> an administrator
 * delivers it. There is no separate "development credits" wallet: credits bought
 * on Billing, plan credits and earned credits all pay for it alike.
 */

export const WEBSITE_PROJECT_KINDS = ["new", "redesign"] as const;
export type WebsiteProjectKind = (typeof WEBSITE_PROJECT_KINDS)[number];

export function isWebsiteProjectKind(value: unknown): value is WebsiteProjectKind {
  return value === "new" || value === "redesign";
}

export type WebsiteProjectStatus = "quote_requested" | "quoted" | "paid" | "fulfilled" | "declined";

/** The add-on each kind is sold under (addons.slug): its purchase row, its spend action. */
export const WEBSITE_ADDON_SLUG: Record<WebsiteProjectKind, string> = {
  new: "website_new",
  redesign: "website_redesign",
};

const SLUG_KIND: Record<string, WebsiteProjectKind> = { website_new: "new", website_redesign: "redesign" };

/** Which kind an add-on is, or null when it is not one of these two. */
export function websiteProjectKindOf(slug: string): WebsiteProjectKind | null {
  return SLUG_KIND[slug] ?? null;
}

/** The screen where the customer asks for one and follows it. */
export const WEBSITE_PROJECTS_PATH = "/website-projects";

export function websiteProjectsHref(kind: WebsiteProjectKind): string {
  return `${WEBSITE_PROJECTS_PATH}?type=${kind}#request`;
}

/**
 * Sign-up for someone who came from the public page: the address they typed
 * fills the form, and ?next= brings them to the request form with the right
 * option chosen - not to "add your website", which they may not have.
 */
export function signUpForWebsiteProject(signUpPath: string, kind: WebsiteProjectKind, email?: string | null): string {
  const next = encodeURIComponent(`${WEBSITE_PROJECTS_PATH}?type=${kind}`);
  const address = email ? `&email=${encodeURIComponent(email)}` : "";
  return `${signUpPath}?next=${next}${address}`;
}

/** A price an administrator can set. Above this is a typo, not a quote. */
export const MAX_WEBSITE_PROJECT_CREDITS = 1_000_000;

/** Requests waiting for a first answer, per workspace. More is a script or a stuck button. */
export const MAX_OPEN_QUOTE_REQUESTS = 5;

/** An http(s) address with a real host; a bare "acme.com" is accepted and given https. */
export function cleanProjectUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value) || value.length > 500) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

/** What the request form sends. Error messages come from the screen's copy, by field name. */
export const websiteProjectRequestSchema = z.object({
  kind: z.enum(WEBSITE_PROJECT_KINDS),
  requestKey: z.string().uuid(),
  brief: z.string().trim().min(20).max(4000),
  existingUrl: z
    .string()
    .trim()
    .transform((value, context) => {
      if (!value) return null;
      const url = cleanProjectUrl(value);
      if (!url) context.addIssue({ code: "custom" });
      return url;
    }),
  requirements: optionalText(4000),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().toLowerCase().email().max(254),
  contactPhone: optionalText(40),
});

export type WebsiteProjectRequestInput = z.input<typeof websiteProjectRequestSchema>;
export type WebsiteProjectField = "brief" | "existingUrl" | "requirements" | "contactName" | "contactEmail" | "contactPhone";

/** One project as its owner sees it: never who at RepGet handled it. */
export type WebsiteProjectRow = {
  id: string;
  kind: WebsiteProjectKind;
  status: WebsiteProjectStatus;
  brief: string;
  existingUrl: string | null;
  requirements: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  scope: string | null;
  /** Null until it is priced. */
  creditCost: number | null;
  creditsPaid: number | null;
  deliveryNote: string | null;
  declineReason: string | null;
  createdAt: Date;
  quotedAt: Date | null;
  paidAt: Date | null;
  fulfilledAt: Date | null;
};

export type RequestQuoteResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fields?: Partial<Record<WebsiteProjectField, string>> };

export type PayProjectResult =
  | { ok: true; credits: number }
  | {
      ok: false;
      /**
       * "price_changed": the price on screen is no longer the price, and `credits` is the current one.
       * "not_enough": the credits do not cover it (and `credits`, `available` say by how much).
       * "unavailable": no such project in this workspace, or it cannot be paid now.
       */
      reason: "price_changed" | "not_enough" | "unavailable";
      error: string;
      credits?: number;
      available?: number;
    };
