"use client";

import { useEffect, useRef } from "react";

import { claimReferral } from "@/lib/referrals/actions";

/**
 * Attaches a pending referral and clears its cookie (lib/referrals/actions.ts).
 *
 * Rendered by the app and onboarding layouts only while a referral cookie is
 * present, so a normal page load does nothing. A Server Action rather than
 * work in the layout because clearing the cookie is a write, which a render
 * cannot do. Once per mount; the action is idempotent anyway.
 */
export function ReferralClaim() {
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    void claimReferral().catch(() => {
      // Attribution is a courtesy; a failure must never disturb the page.
    });
  }, []);
  return null;
}
