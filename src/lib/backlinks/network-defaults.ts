/**
 * Partner Network defaults shared by every path that creates membership.
 *
 * Kept outside the "use server" action modules, which may only export
 * async functions.
 */

/**
 * The monthly hosting cap written on each website's network row.
 *
 * Since 2026-09-28 it limits NOTHING in the managed Partner Network: links
 * are placed by administrators, and no per-host cap applies
 * (lib/backlinks/managed.ts). Only the old automatic exchange - switched off
 * by MANAGED_NETWORK - would still read it, and for that it stays low.
 */
export const DEFAULT_MONTHLY_CAP = 3;
