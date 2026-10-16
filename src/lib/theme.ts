/**
 * Night mode (client, 2026-10-16: "To enable night mode with one button on
 * the whole website, maybe someone prefers black mode instead of white").
 *
 * The dark palette has always been in globals.css (`.dark`); nothing turned
 * it on. Now one button (components/theme-toggle.tsx) on the public site, the
 * app, onboarding and admin switches it, and the choice is remembered in this
 * browser. Light stays the default: nobody's site changes unless they ask.
 *
 * The choice is applied by THEME_SCRIPT, inline in <head> (app/layout.tsx),
 * before the first paint - so a dark page never flashes white while it loads.
 * Cached public pages allow inline scripts; the pages under the per-request
 * nonce policy allow exactly this one by its hash (THEME_SCRIPT_HASH, in
 * lib/security-headers.ts). Change the script and the hash follows, because
 * it is computed from this string.
 *
 * Kept in the browser (localStorage), not a cookie: the server never needs
 * it, and a cookie read on the server would make every cached page render per
 * request.
 */

export const THEME_KEY = "repget-theme";

export type Theme = "light" | "dark";

/** Before the first paint: the remembered choice. Never throws - private modes can refuse storage. */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
