import type { TransitionTable } from "./state-machine";

/**
 * An application to join the partner program.
 *
 * One open application per user at a time (enforced by a partial unique
 * index). Approval creates or reactivates the user's single partner profile;
 * a rejected applicant may apply again with a new application, and every
 * application stays on record.
 */

export type ApplicationStatus = "submitted" | "approved" | "rejected" | "withdrawn";

export const APPLICATION_TRANSITIONS: TransitionTable<ApplicationStatus> = {
  submitted: ["approved", "rejected", "withdrawn"],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export type ApplicationAnswers = {
  /** Where the partner will promote RepGet: a site, channel or newsletter URL. */
  website: string;
  /** Who they reach, in their own words. */
  audience: string;
  /** How they plan to promote. */
  promotion: string;
  /** ISO 3166-1 alpha-2 country they would be paid in. */
  country: string;
};

/**
 * The one definition of how long the answers may be, for the server's checks
 * (use-cases/submit-application.ts, presentation/validation.ts) and the
 * form's counters (components/partners/application-form.tsx). Lengths are
 * of the trimmed answer. The answers are stored as jsonb with no length
 * constraint of their own. Minimum and maximum from Daniel's form design
 * (2026-11-07): 15 and 1,200 characters, up from 10 and 1,000.
 */
export const APPLICATION_LIMITS = {
  website: 300,
  /** The fewest characters an audience or promotion answer may have. */
  textMin: 15,
  audience: 1200,
  promotion: 1200,
} as const;
