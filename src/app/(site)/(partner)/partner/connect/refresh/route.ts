import { NextResponse, type NextRequest } from "next/server";

import { refreshOnboardingLink } from "@/lib/partners/application/use-cases/manage-payout-account";
import { PartnerGuardError, requireActivePartner } from "@/lib/partners/presentation/guards";
import { partnerDeps } from "@/lib/partners/server";

/**
 * Stripe's refresh_url: the onboarding link expired or was already used.
 * Makes a fresh single-use link for the SIGNED-IN partner's own existing
 * account and sends them back to Stripe. Never creates an account (a GET
 * must not), and never acts on an account named in the URL.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const back = new URL("/partner/settings?onboarding=retry", request.url);
  try {
    const access = await requireActivePartner();
    const result = await refreshOnboardingLink(partnerDeps(), access);
    if (result.ok) return NextResponse.redirect(result.value.url);
  } catch (error) {
    if (error instanceof PartnerGuardError && error.reason === "unauthenticated") {
      return NextResponse.redirect(new URL("/sign-in?next=/partner/settings", request.url));
    }
    if (!(error instanceof PartnerGuardError)) console.error("[partners] onboarding refresh failed", error);
  }
  return NextResponse.redirect(back);
}
