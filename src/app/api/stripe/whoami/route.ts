import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin/guard";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";

/**
 * Which Stripe account and mode THIS deployment is actually using.
 *
 * Exists because a mode or account mismatch is invisible from the outside: the
 * database is shared between environments, so `npm run doctor` run locally can
 * report every price as valid while the deployed app fails on the very same
 * ids. The only way to tell them apart is to ask the running deployment which
 * credentials it holds.
 *
 * Admin-only, and it never returns the key — only the account id, the mode,
 * and a short fingerprint of the key so two environments can be compared
 * without either being disclosed.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  // Same guard as the admin pages: an unauthenticated caller gets nothing,
  // not even confirmation that Stripe is configured.
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = key.startsWith("sk_live_")
    ? "live"
    : key.startsWith("sk_test_")
      ? "test"
      : "unknown";

  /**
   * First and last four characters only. Enough to tell two keys apart at a
   * glance; useless to anyone who obtains it.
   */
  const fingerprint =
    key.length > 16 ? `${key.slice(0, 12)}…${key.slice(-4)}` : "(too short)";

  try {
    // `null` means "the account this key authenticates as" — the SDK types
    // it as `string | null` and has no zero-argument overload.
    const account = await stripe.accounts.retrieve(null);
    return NextResponse.json({
      configured: true,
      mode,
      keyFingerprint: fingerprint,
      accountId: account.id,
      accountName: account.settings?.dashboard?.display_name ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        mode,
        keyFingerprint: fingerprint,
        error: error instanceof Error ? error.message : "Stripe call failed",
      },
      { status: 502 },
    );
  }
}
