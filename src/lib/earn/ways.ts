/**
 * The extra ways to earn credits on the Earn Credits page (client design,
 * 2026-11-02), beside the referral program.
 *
 * Each is a CLAIM that the RepGet team reviews (lib/earn/actions.ts,
 * lib/earn/admin.ts): nothing is credited on submission, and each way pays
 * once per workspace. Reviews never ask for praise - an honest, critical
 * story or idea qualifies just as well - and public posts must say the
 * author may receive credits; the page and the FAQ say both.
 *
 * Plain data, imported by the page, the server actions and the admin page.
 */

export const EARN_KINDS = ["story", "post", "tutorial", "feedback"] as const;
export type EarnKind = (typeof EARN_KINDS)[number];

export type EarnWay = {
  kind: EarnKind;
  /** Credits added when the team approves it. */
  credits: number;
  /** A public link is the proof (a post, a tutorial); otherwise the text is. */
  needsLink: boolean;
  /** Shortest text accepted, so "great app" is not a submission. */
  minMessage: number;
};

/** The client's figures from the design: +25, +20, +40, +10. */
export const EARN_WAYS: Record<EarnKind, EarnWay> = {
  story: { kind: "story", credits: 25, needsLink: false, minMessage: 80 },
  post: { kind: "post", credits: 20, needsLink: true, minMessage: 10 },
  tutorial: { kind: "tutorial", credits: 40, needsLink: true, minMessage: 10 },
  feedback: { kind: "feedback", credits: 10, needsLink: false, minMessage: 40 },
};

export function isEarnKind(value: unknown): value is EarnKind {
  return typeof value === "string" && (EARN_KINDS as readonly string[]).includes(value);
}

/** What one claim shows on the page: none sent, waiting, approved or declined (and why). */
export type EarnClaim = {
  kind: EarnKind;
  status: "pending" | "approved" | "declined";
  credits: number;
  reviewNote: string | null;
  at: Date;
};
