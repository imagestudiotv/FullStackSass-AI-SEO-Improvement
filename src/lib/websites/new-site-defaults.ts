import { DEFAULT_MONTHLY_CAP } from "@/lib/backlinks/network-defaults";

/**
 * What a NEW website starts with - the client's agreed defaults.
 *
 * Written explicitly by addWebsite rather than as database column defaults.
 * During a deploy the previous build keeps running for a while, and after a
 * rollback it runs again; a changed column default would silently apply to
 * the websites IT creates too, turning on live publishing for a build that
 * knows nothing about the review gate. Keeping the defaults in code means
 * only this build hands them out. Existing websites are never changed.
 */
export const NEW_SITE_DEFAULTS = {
  /** "Publish live on the planned day" (with publishAs, whose default is live). */
  autoPublish: true,
  publishAs: "live",
  tableOfContents: true,
  mentionSimilarProducts: true,
  /** Also the column default (existing websites got it too); listed so the set is in one place. */
  comparisonTable: true,
  /** Already the column default; listed so the whole set is in one place. */
  poweredByLink: true,
} as const;

/**
 * The set for a website created now. Under the two-step flow (lib/publishing/
 * controls.ts) a new website starts on the customer's own Publish press, as the
 * client's flow describes: automatic publishing is something they choose on the
 * Publishing page, not something a default chose for them. Existing websites
 * are never changed.
 */
export function newSiteDefaults(twoStep: boolean) {
  return twoStep ? { ...NEW_SITE_DEFAULTS, autoPublish: false } : NEW_SITE_DEFAULTS;
}

/** The Partner Network row every new website gets, in the same transaction. */
export const NEW_SITE_NETWORK = {
  acceptingLinks: true,
  monthlyCap: DEFAULT_MONTHLY_CAP,
} as const;
