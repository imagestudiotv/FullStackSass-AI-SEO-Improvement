/**
 * What the WordPress card is waiting for, and what ended the wait.
 *
 * A pure function, so every sequence can be tested without a browser
 * (connect-watch.test.ts). The card calls it whenever the server sends a
 * fresh list of keys.
 *
 * WHY THE SERVER DECIDES "PENDING". A button key counts as a connection
 * under way while it is unused, younger than the grace period and not
 * superseded by a NEWER key that connected - worked out on the database's
 * clock (listIntegrationKeys). Deciding it in the browser disagreed with the
 * server's first render near the 30-minute edge, and kept a card "waiting"
 * beside "Connected" when a second press had already connected.
 *
 * No server imports: the card imports this file.
 */

export type WatchedKey = {
  keyPrefix: string;
  lastUsedAt: Date | string | null;
  /** From the server: a button key still waiting for WordPress to use it. */
  pending: boolean;
};

export type WatchState = {
  /** Prefixes of keys this screen is waiting for WordPress to use. */
  watching: string[];
  /** Watched prefixes the server has listed at least once: missing after that means revoked. */
  seen: string[];
  /**
   * Prefixes already used when the wait began. Any OTHER key becoming used
   * means WordPress connected - with the watched key or a key from another
   * tab - while the hourly check-ins of an install already connected are
   * ignored.
   */
  baseline: string[];
};

export type WatchOutcome =
  /** WordPress connected (with a watched key, or a newer key from another tab). */
  | "connected"
  /** A watched key disappeared (revoked, replaced) before it was used. */
  | "replaced"
  /** The watched keys are no longer pending (past the grace period) and nothing connected. */
  | "expired"
  | null;

export const IDLE: WatchState = { watching: [], seen: [], baseline: [] };

const usedPrefixes = (keys: WatchedKey[]) => keys.filter((key) => key.lastUsedAt).map((key) => key.keyPrefix);

/** The wait on arrival: every key the server lists as pending (after a reload, say). */
export function resumeWatch(keys: WatchedKey[]): WatchState {
  const pending = keys.filter((key) => key.pending).map((key) => key.keyPrefix);
  return pending.length === 0 ? IDLE : { watching: pending, seen: pending, baseline: usedPrefixes(keys) };
}

/** Starts (or extends) a wait for a key this screen just made. */
export function watchKey(state: WatchState, prefix: string, keys: WatchedKey[]): WatchState {
  if (state.watching.includes(prefix)) return state;
  return state.watching.length === 0
    ? { watching: [prefix], seen: [], baseline: usedPrefixes(keys) }
    : { ...state, watching: [...state.watching, prefix] };
}

/** The server sent a new list of keys: is the wait over, and why? */
export function reconcileWatch(state: WatchState, keys: WatchedKey[]): { state: WatchState; outcome: WatchOutcome } {
  if (state.watching.length === 0) return { state, outcome: null };

  if (keys.some((key) => key.lastUsedAt && !state.baseline.includes(key.keyPrefix))) {
    return { state: IDLE, outcome: "connected" };
  }

  const listed = new Map(keys.map((key) => [key.keyPrefix, key]));
  const seen = [...new Set([...state.seen, ...state.watching.filter((prefix) => listed.has(prefix))])];
  // Still waiting: listed as pending, or just made and not listed yet.
  const waiting = state.watching.filter((prefix) => listed.get(prefix)?.pending || (!listed.has(prefix) && !seen.includes(prefix)));
  if (waiting.length > 0) return { state: { ...state, watching: waiting, seen }, outcome: null };

  const vanished = state.watching.some((prefix) => seen.includes(prefix) && !listed.has(prefix));
  return { state: IDLE, outcome: vanished ? "replaced" : "expired" };
}
