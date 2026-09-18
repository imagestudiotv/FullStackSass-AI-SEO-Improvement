import { permanentRedirect } from "next/navigation";

/**
 * The brand-profile step is now part of /onboarding/setup.
 *
 * Its three subjects — market and language, business description, competitors
 * — were merged onto one screen at the client's request, so this URL no longer
 * has a page of its own. It is kept rather than deleted because it was the
 * destination of the website step for weeks: it is in browser histories, in
 * the client's own test notes, and in any link sent to Daniel.
 *
 * permanentRedirect rather than redirect: the move is not conditional, and a
 * 308 lets browsers stop asking.
 */
export default async function OnboardingProfilePage({
  searchParams,
}: PageProps<"/onboarding/profile">) {
  const params = await searchParams;
  const site = typeof params.site === "string" ? params.site : null;
  // The website id is carried through; without it the next screen falls back
  // to the oldest site, which is wrong for anyone adding their second.
  permanentRedirect(
    site ? `/onboarding/setup?site=${site}` : "/onboarding/setup",
  );
}
