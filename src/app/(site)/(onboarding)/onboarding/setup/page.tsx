import { permanentRedirect } from "next/navigation";

/**
 * Retired: the business-profile step of signup.
 *
 * See onboarding/profile/page.tsx for the full note — both URLs led to the
 * same screen and both now land on the dashboard's launch checklist.
 */
export default async function RetiredSetupStepPage() {
  permanentRedirect("/setup");
}
