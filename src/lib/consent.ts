/**
 * The visitor's answer to the analytics cookie banner
 * (components/consent-banner.tsx).
 *
 * Kept in a first-party cookie of our own. Remembering a refusal needs no
 * consent (it is what makes the refusal stick), and nothing else is stored
 * in it. Six months, then the banner asks again, as the French and Italian
 * regulators expect; the version prefix lets a material change to what we
 * ask about void every earlier answer.
 *
 * NO IMPORTS: this runs in every visitor's browser, and is tested as plain
 * functions.
 */

export const CONSENT_COOKIE = "repget_consent";
const VERSION = "1";
/** Six months, in seconds. */
export const CONSENT_MAX_AGE = 182 * 24 * 60 * 60;

export type Consent = "granted" | "denied";

/** The stored answer in a `document.cookie` string, or null when there is none we understand. */
export function parseConsent(cookies: string): Consent | null {
  for (const part of cookies.split(";")) {
    const at = part.indexOf("=");
    if (at === -1 || part.slice(0, at).trim() !== CONSENT_COOKIE) continue;
    const value = part.slice(at + 1).trim();
    if (value === `${VERSION}.granted`) return "granted";
    if (value === `${VERSION}.denied`) return "denied";
    return null;
  }
  return null;
}

export function consentCookie(consent: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${VERSION}.${consent}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * The answer given on this page, for a browser that refuses cookies: without
 * it the banner would come straight back after a press. The next page load
 * asks again, which is all such a browser allows.
 */
let answered: Consent | null = null;

/** Browser only. */
export function readConsent(): Consent | null {
  try {
    return parseConsent(document.cookie) ?? answered;
  } catch {
    return answered;
  }
}

const CHANGE = "repget:consent-change";
const OPEN = "repget:consent-open";

/** Stores the answer and tells every listener on the page (the banner, the tracker). */
export function saveConsent(consent: Consent): void {
  answered = consent;
  try {
    document.cookie = consentCookie(consent, window.location.protocol === "https:");
  } catch {
    // Cookies blocked: the answer still applies to this page.
  }
  window.dispatchEvent(new CustomEvent<Consent>(CHANGE, { detail: consent }));
}

export function onConsentChange(listener: (consent: Consent) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<Consent>).detail);
  window.addEventListener(CHANGE, handler);
  return () => window.removeEventListener(CHANGE, handler);
}

/** The "Cookie settings" links: shows the banner again so the answer can be changed. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN));
}

export function onConsentSettingsOpen(listener: () => void): () => void {
  window.addEventListener(OPEN, listener);
  return () => window.removeEventListener(OPEN, listener);
}
