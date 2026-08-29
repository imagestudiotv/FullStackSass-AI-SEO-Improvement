/**
 * Usage types and constants that the client bundle may import.
 *
 * Kept apart from lib/usage.ts, which imports the database. A client component
 * importing UNLIMITED or LimitCheck from there drags the Postgres driver into
 * the browser build and fails the compile.
 */

/** Sentinel for "no limit applies". Infinity is not JSON-serialisable — it
 *  becomes null over the wire — so unlimited is represented explicitly. */
export const UNLIMITED = -1;

export type LimitCheck = {
  allowed: boolean;
  used: number;
  /** Plan limit, or UNLIMITED (-1) when the kind is metered but not capped. */
  limit: number;
  reason: string | null;
};
