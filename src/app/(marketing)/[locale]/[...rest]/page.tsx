import { notFound } from "next/navigation";

/**
 * Any address under a language prefix that is not one of its pages
 * (/es/no-such-page, /fr/tools): a 404, answered here rather than by the root
 * not-found page.
 *
 * The root one is built once, ahead of time, for no address in particular -
 * so it was written in English, and in a Spanish visitor's browser it then
 * redrew itself in Spanish, which React reports as an error (a hydration
 * mismatch). Answered here, the page is drawn for the address actually asked
 * for, inside the public site's layout, by (marketing)/not-found.tsx, with a
 * real 404 status. Real pages (/es/pricing) are matched before this.
 */
export default function UnknownTranslatedPage() {
  notFound();
}
