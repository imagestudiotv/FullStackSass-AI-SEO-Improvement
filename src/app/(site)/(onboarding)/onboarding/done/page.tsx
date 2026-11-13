import { permanentRedirect } from "next/navigation";

/**
 * The old "you are set up" celebration page, now the dashboard's checklist.
 *
 * The client asked for signup to end inside the product rather than on a
 * screen of its own: "Right after this 5 step, can the next one be directly
 * the integration part. We start seeing the dashboard on the left."
 *
 * Kept as a redirect rather than deleted because it was the wizard's last
 * step for weeks — it is in browser histories, in the client's test notes,
 * and in any link shared with Daniel.
 *
 * permanentRedirect rather than redirect: the move is unconditional, and a
 * 308 lets browsers stop asking.
 */
export default async function OnboardingDonePage() {
  permanentRedirect("/setup");
}
