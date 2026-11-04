/**
 * What the homepage's two "start here" fields (the hero's and the closing
 * banner's) accept, and where it takes the visitor. One copy, so the two
 * cannot come to disagree.
 */

/**
 * Accepts what people actually type - "acme.com", "www.acme.com",
 * "https://acme.com/shop" - and returns it trimmed, or null.
 *
 * Deliberately loose: this only decides whether the address is worth
 * carrying through sign-up. The website step re-validates it (and owns the
 * reachability checks), so a second strict copy of those rules here would
 * only drift from them. URL() also punycodes an international domain, hence
 * the xn-- top-level domains.
 */
export function cleanWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;
    return host.test(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

export function cleanEmail(raw: string): string | null {
  const value = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

/** The website step with the typed address pre-filled. */
export const websiteStep = (onboardingPath: string, domain: string) => `${onboardingPath}?domain=${encodeURIComponent(domain)}`;

/** Sign-up, then the website step with the typed address pre-filled. */
export const signUpWithWebsite = (signUpPath: string, onboardingPath: string, domain: string) =>
  `${signUpPath}?next=${encodeURIComponent(websiteStep(onboardingPath, domain))}`;

/** Sign-up with the typed address pre-filled. */
export const signUpWithEmail = (signUpPath: string, email: string) => `${signUpPath}?email=${encodeURIComponent(email)}`;
