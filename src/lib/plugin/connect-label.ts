/**
 * Labels on integration keys that mark HOW a key was made.
 *
 * Shared by the server (lib/plugin/keys.ts, which tidies up unused keys) and
 * the key list on screen, which shows them in the reader's language instead
 * of these English strings. No server imports: the screen imports this file.
 *
 * - CONNECT_KEY_LABEL: made by the "Connect WordPress" button. Unused ones
 *   are tidied up after a grace period.
 * - MANUAL_KEY_LABEL: made with "New key" and no note - a key for a second
 *   install connected by hand. NEVER tidied up: a person made it on purpose.
 * - No label (null): made when the setup screen used to open, before
 *   2026-09-29, and never shown again. Tidied up once WordPress connects.
 */
export const CONNECT_KEY_LABEL = "Connect WordPress";
export const MANUAL_KEY_LABEL = "Added by hand";

/** Labels a person cannot type as a note: they would change how the key is treated. */
export const RESERVED_KEY_LABELS: readonly string[] = [CONNECT_KEY_LABEL, MANUAL_KEY_LABEL];
