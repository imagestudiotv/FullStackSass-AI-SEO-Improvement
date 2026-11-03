import { PREFIXED_LOCALES } from "./config";

/**
 * The page's language on <html lang>, for /es, /fr, /it and /de.
 *
 * The root layout (app/layout.tsx) is shared by every page and cannot read
 * the [locale] segment beneath it, so the HTML it sends says lang="en" on the
 * German pages too. Fixing that on the server would mean a separate root
 * layout per language (client chose the light fix, 2026-11-03). Instead:
 *  - LANG_SCRIPT, inline in <head>, sets it from the address before the
 *    first paint - so screen readers, the browser's "translate this page?"
 *    and Google's renderer all see German on /de;
 *  - components/document-lang.tsx keeps it right as the visitor moves between
 *    pages without a reload (from / to /de through a link).
 * Google itself reads the page's words and the hreflang links, which were
 * already right; the lang attribute is for everyone else.
 *
 * Allowed on the nonce pages by its hash (lib/security-headers.ts
 * LANG_SCRIPT_HASH); the test there recomputes it from this string.
 */
export const LANG_SCRIPT = `try{var m=location.pathname.match(/^\\/(${PREFIXED_LOCALES.join("|")})(?=\\/|$)/);if(m)document.documentElement.lang=m[1]}catch(e){}`;
