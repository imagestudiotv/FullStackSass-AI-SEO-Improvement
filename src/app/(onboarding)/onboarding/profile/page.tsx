import { permanentRedirect } from "next/navigation";

/**
 * The business profile left signup entirely.
 *
 * It was step two — market, language, description, competitors — and at the
 * client's request it moved onto the dashboard, where it sits on the launch
 * checklist and on the website's own profile page. Analysis still fills it in
 * automatically, so nothing is lost by not asking during signup.
 *
 * Both this URL and /onboarding/setup land here. Kept rather than deleted
 * because they were the wizard's second step for weeks: they are in browser
 * histories, in the client's test notes, and in links shared with Daniel.
 *
 * Sent to /setup rather than straight to the profile page: /setup resolves
 * which website the customer means, which a bare redirect cannot do.
 */
export default async function RetiredProfileStepPage() {
  permanentRedirect("/setup");
}
