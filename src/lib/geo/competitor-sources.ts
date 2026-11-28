/**
 * Where a row of the profile's competitors came from (competitors.source).
 * Kept apart from lib/geo/competitors.ts so the profile's actions and page
 * can read them without loading the sync's model client.
 *
 *  - "manual": the customer added it;
 *  - "ai_suggested" (or NULL on older rows): website analysis suggested it;
 *  - AI_VISIBILITY_SOURCE: an AI assistant recommended it in an AI visibility
 *    check (lib/geo/competitors.ts);
 *  - DISMISSED_SOURCE: a suggestion the customer removed - kept, hidden, so
 *    nothing suggests the same rival again.
 */
export const AI_VISIBILITY_SOURCE = "ai_visibility";
export const DISMISSED_SOURCE = "dismissed";
