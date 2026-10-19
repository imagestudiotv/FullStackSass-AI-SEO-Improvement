import { normaliseReferralCode } from "../../domain/entities/partner";
import { clickExpiry } from "../../domain/policies/attribution";
import type { PartnerDeps } from "./deps";

/**
 * A visitor opened a partner's link (/go/<code>).
 *
 * The browser gets a RANDOM token (256 bits) in the partner cookie; the click
 * row stores only its SHA-256. The token proves nothing by itself - it only
 * finds this row - and cannot be edited into another partner's click.
 *
 * FIRST VALID LINK WINS: a browser that already carries an unexpired click
 * keeps it, and opening a second partner's link counts that partner's click
 * for reporting without moving the cookie. A reload within half an hour by
 * the same visitor is not counted twice. Public and unauthenticated, so it is
 * rate-limited per visitor and globally, and an over-limit visit is simply not
 * recorded (the visitor still lands on the site).
 */

export const CLICK_RATE = { perVisitorPerMinute: 30, globalPerMinute: 3000 } as const;
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

export type ClickInput = {
  code: string;
  /** The partner cookie's token, if the browser already has one. */
  existingToken: string | null;
  landingPath: string | null;
  referrerHost: string | null;
  /** A stable visitor identity (the network, as visitorKey derives it); hashed before storage. */
  visitor: string;
};

export type ClickOutcome = {
  /** Set this cookie (first touch). Null: keep whatever the browser has. */
  setCookie: { token: string; expiresAt: Date } | null;
  recorded: boolean;
  reason?: "program_closed" | "unknown_code" | "inactive_partner" | "rate_limited" | "duplicate";
};

export async function recordReferralClick(deps: PartnerDeps, input: ClickInput): Promise<ClickOutcome> {
  const repos = deps.uow.repositories;
  if (!(await repos.controls.isEnabled("partner_program"))) {
    return { setCookie: null, recorded: false, reason: "program_closed" };
  }
  const code = normaliseReferralCode(input.code);
  if (!code) return { setCookie: null, recorded: false, reason: "unknown_code" };
  const partner = await repos.partners.findByReferralCode(code);
  if (!partner) return { setCookie: null, recorded: false, reason: "unknown_code" };
  if (partner.status !== "active") return { setCookie: null, recorded: false, reason: "inactive_partner" };

  const visitorHash = deps.hasher.hmac(input.visitor);
  const admitted = await deps.burstLimiter.admit(
    [
      { key: `partner-click:visitor:${visitorHash}`, limit: CLICK_RATE.perVisitorPerMinute, windowSeconds: 60 },
      { key: "partner-click:global", limit: CLICK_RATE.globalPerMinute, windowSeconds: 60 },
    ],
    "partner.click",
  );
  if (!admitted) return { setCookie: null, recorded: false, reason: "rate_limited" };

  const now = deps.clock.now();
  const existing = input.existingToken
    ? await repos.tracking.findClickByTokenHash(deps.hasher.sha256(input.existingToken))
    : null;
  const firstTouchStands = existing !== null && existing.expiresAt.getTime() > now.getTime();

  if (firstTouchStands && (await repos.tracking.recentClick(partner.id, visitorHash, new Date(now.getTime() - DUPLICATE_WINDOW_MS)))) {
    return { setCookie: null, recorded: false, reason: "duplicate" };
  }

  const version = await repos.programs.versionAt(now);
  const token = deps.random.token();
  const expiresAt = clickExpiry(version.policy, now);
  await repos.tracking.createClick({
    partnerId: partner.id,
    tokenHash: deps.hasher.sha256(token),
    clickedAt: now,
    expiresAt,
    landingPath: input.landingPath?.slice(0, 200) ?? null,
    referrerHost: input.referrerHost?.slice(0, 200) ?? null,
    visitorHash,
  });
  // A browser already attributed to a (possibly other) partner keeps its first touch.
  return { setCookie: firstTouchStands ? null : { token, expiresAt }, recorded: true };
}
