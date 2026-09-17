import { redirect } from "next/navigation";

/**
 * "Add a website", from the dashboard and the website switcher.
 *
 * Both have linked here since before setup existed, and nothing was ever
 * built at this path — so the two most obvious ways to add a second website
 * went to a 404.
 *
 * It redirects to setup rather than rendering a second copy of the same form.
 * A second website needs everything the first one did: its own plan, its own
 * profile check, its own visibility questions, its own first article. A bare
 * "add a site" form would create the row and leave the customer with a
 * website that cannot generate anything and no indication why.
 *
 * `next=1` tells the website step this is an additional site rather than the
 * first, so it does not send someone who already has a site straight past the
 * form to the next unfinished step.
 */
export default function NewWebsitePage() {
  redirect("/onboarding/website?next=1");
}
