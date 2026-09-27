/**
 * Partner Network defaults shared by every path that creates membership.
 *
 * Kept outside the "use server" action modules, which may only export
 * async functions.
 */

/**
 * Links a site hosts per month by default. Low on purpose: a site hosting
 * many outbound links a month starts to look like a link farm, which harms
 * the host far more than it helps anyone.
 */
export const DEFAULT_MONTHLY_CAP = 3;
