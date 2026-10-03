import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { ProviderErrorKind } from "@/lib/publishing/provider";

/**
 * Stored failures and action refusals, in the reader's language.
 *
 * The stored strings are written for logs: an internal configuration name, a
 * provider's raw response. They are CLASSIFIED on the server (page.tsx) and
 * only the kind crosses to the browser, so nothing internal is serialised
 * into the page. The kinds follow lib/articles/explain.ts and
 * lib/publishing/explain.ts - same patterns, same order - whose English-only
 * copy this page used to print; the wording here is provider-neutral, since
 * the same failure kinds come from Ghost, Shopify, Wix and Webflow too, not
 * only WordPress.
 */

type EditorCopy = Messages["app"]["editor"];

export type GenerationFailureKind = "unavailable" | "busy" | "timeout" | "unusable" | "quota" | "generic";

/** Ordered: the first match wins (lib/articles/explain.ts). */
const GENERATION_PATTERNS: { match: RegExp; kind: GenerationFailureKind }[] = [
  { match: /api[_ ]key|not set|credentials/i, kind: "unavailable" },
  { match: /rate limit|429|overloaded|capacity/i, kind: "busy" },
  { match: /timeout|timed out|ETIMEDOUT|ECONNRESET/i, kind: "timeout" },
  { match: /declined|truncated|no outline|not valid json|no sections/i, kind: "unusable" },
  { match: /limit reached|quota|plan/i, kind: "quota" },
];

export function generationFailureKind(stored: string | null | undefined): GenerationFailureKind {
  if (!stored) return "generic";
  return GENERATION_PATTERNS.find(({ match }) => match.test(stored))?.kind ?? "generic";
}

export function generationFailureText(kind: GenerationFailureKind, t: EditorCopy): string {
  switch (kind) {
    case "unavailable":
      return t.genUnavailable;
    case "busy":
      return t.genBusy;
    case "timeout":
      return t.genTimeout;
    case "unusable":
      return t.genUnusable;
    case "quota":
      return t.genQuota;
    default:
      return t.genGeneric;
  }
}

const PUBLISH_KINDS: readonly ProviderErrorKind[] = [
  "auth",
  "permission",
  "not_found",
  "unreachable",
  "api_disabled",
  "unsupported",
  "unknown",
];

/** Reads the "<kind>: message" prefix the publish job stores; anything else is "unknown". */
export function publishFailureKind(stored: string | null | undefined): ProviderErrorKind {
  if (!stored) return "unknown";
  const separator = stored.indexOf(":");
  if (separator <= 0) return "unknown";
  const prefix = stored.slice(0, separator).trim();
  return PUBLISH_KINDS.find((kind) => kind === prefix) ?? "unknown";
}

export function publishFailureText(kind: ProviderErrorKind, t: EditorCopy): string {
  switch (kind) {
    case "auth":
      return t.pubErrAuth;
    case "permission":
      return t.pubErrPermission;
    case "not_found":
      return t.pubErrNotFound;
    case "unreachable":
      return t.pubErrUnreachable;
    case "api_disabled":
      return t.pubErrApiDisabled;
    case "unsupported":
      return t.pubErrUnsupported;
    default:
      return t.pubErrUnknown;
  }
}

/** "That image is 9.4 MB. The limit is 8 MB." with the numbers in the reader's convention (9,4 in German). */
export function imageSizeErrorText(bytes: number, maxBytes: number, locale: Locale, t: EditorCopy): string {
  const megabytes = (value: number, step: number) =>
    formatNumber(Math.round((value / 1024 / 1024) * step) / step, locale);
  return format(t.imageSizeError, { size: megabytes(bytes, 10), max: megabytes(maxBytes, 1) });
}

/**
 * A server action's refusal, translated when it is one this page knows.
 *
 * The actions answer in English (they are shared with other screens and
 * with admin). Their wording is matched here, at the edge, and anything not
 * recognised is shown as it came - a real reason in English beats a vague
 * translated one.
 */
export function actionErrorText(
  error: string,
  copy: {
    t: EditorCopy;
    tWorkspace: Messages["app"]["workspace"];
    tImage: Messages["app"]["image"];
  },
): string {
  const { t, tWorkspace, tImage } = copy;
  const known: [RegExp, string][] = [
    [/^You have view-only access/i, tWorkspace.viewOnly],
    [/being delivered to the website right now/i, t.errInFlight],
    [/being prepared by the RepGet team/i, t.stateReviewPending],
    [/^Title cannot be empty/i, t.titleRequired],
    [/has not been written yet/i, t.errNotWritten],
    [/^Connect somewhere to publish/i, t.errConnectFirst],
    [/no plan entry to rebuild from/i, t.rewriteNoPlan],
    [/^Article not found/i, t.errNotFound],
    [/has rewritten \d+ articles in the last day/i, t.errRewriteCap],
    [/already being written/i, t.errAlreadyWriting],
    [/no active plan/i, t.errNoActivePlan],
    [/^Image storage is not set up/i, t.errImageStorage],
    [/^Image generation is not set up/i, t.errImageGeneration],
    [/^Use a PNG, JPEG or WebP image/i, t.imageTypeError],
    [/regenerated this image \d+ times/i, tImage.noRegensLeft],
  ];
  return known.find(([pattern]) => pattern.test(error))?.[1] ?? error;
}
