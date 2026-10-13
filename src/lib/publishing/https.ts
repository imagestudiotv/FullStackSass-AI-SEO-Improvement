import type { InsecureTransportError } from "@/lib/net/safe-fetch";

/**
 * Publishing connections send a credential to the customer's own address:
 * WordPress an application password, Ghost a signed admin token, a webhook a
 * signature and the unpublished article. Over plain http anyone on the path
 * could read and replay them, so those addresses must be https - checked when
 * the connection is made (below) and again on every request
 * (safeFetch's `credentialed`), which also covers connections stored before
 * this rule. Nothing is switched from http to https automatically: the site
 * may not serve https at all, or serve another site there, so the customer
 * reconnects with the address that works.
 */

/** The error to show for a credential-bearing address that is not https, or null when it is. */
export function httpsRequiredError(label: string, url: string): string | null {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return `${label}: that is not a valid address`;
  }
  if (protocol === "https:") return null;
  return `${label} must start with https://. This connection sends a password or key to it, which plain http would expose. If your site has no HTTPS yet, turn it on at your host first (most offer a free certificate).`;
}

/**
 * What a customer sees when a stored connection is refused at request time.
 * Nothing was sent; reconnecting with the https:// address fixes it.
 */
export function insecureConnectionMessage(storedUrl: string, error: InsecureTransportError, secret: string): string {
  if (/^http:\/\//i.test(storedUrl)) {
    return `This connection was saved with an http:// address, which would send ${secret} unencrypted, so nothing was sent. Reconnect it under Publishing with your site's https:// address.`;
  }
  return error.message;
}
