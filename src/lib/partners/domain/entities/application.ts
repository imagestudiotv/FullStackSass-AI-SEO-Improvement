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

export const APPLICATION_LIMITS = {
  website: 300,
  audience: 1000,
  promotion: 1000,
} as const;
