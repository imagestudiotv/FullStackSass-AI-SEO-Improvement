import "server-only";

import { crispApiConfig, type CrispApiConfig } from "./crisp-digest";

/**
 * "Do not show it to ... anyone who has already started a support
 * conversation" (ticket 2026-11-19, item 6): the conversations our own
 * database cannot see - one from before the welcome shipped, or one started
 * by email - asked of Crisp itself, by the person's email, just before the
 * welcome is claimed (lib/support/onboarding-welcome.ts claimWelcome).
 *
 * Crisp's REST API v1 (docs.crisp.chat/references/rest-api/v1/):
 *  1. "List People Conversations": GET /v1/website/{website_id}/people/
 *     conversations/{people_id}/list/{page}, where people_id may be the
 *     person's email. A 404 is no people profile, so no conversation.
 *  2. Its items are the profile's conversations. The in-app chat sets the
 *     signed-in email on Crisp's session (components/live-chat.tsx), so a
 *     profile can carry a session nobody wrote in yet - the very visit we
 *     are about to welcome. So a conversation counts only when Crisp has a
 *     message in it: "Get A Conversation" (GET /v1/website/{website_id}/
 *     conversation/{session_id}) and its last_message / preview_message.
 *
 * The same website token as the daily digest (crisp-digest.ts crispApiConfig:
 * CRISP_API_IDENTIFIER, CRISP_API_KEY, NEXT_PUBLIC_CRISP_WEBSITE_ID). Plugin
 * tokens need the scopes website:people:conversations and
 * website:conversation:sessions.
 *
 * NEVER IN THE WAY. Unset, failing, slow (TIMEOUT_MS for the whole check) or
 * rate limited, the answer is "unknown" and the welcome goes ahead exactly as
 * before - with a warning in the logs, never an exception. Crisp publishes no
 * per-route numbers, only "429 Too Many Requests" / "420 Enhance Your Calm"
 * and a daily quota (10,000 requests for a website token), so after either
 * of those this asks nothing for RATE_LIMIT_PAUSE_MS. One check is at most
 * 1 + MAX_SESSIONS requests, and it runs once per welcome claim, not per page.
 */

const API = "https://api.crisp.chat/v1";
const TIMEOUT_MS = 3_000;
/** At most this many of the profile's conversations are opened to look for a message. */
const MAX_SESSIONS = 3;
const RATE_LIMIT_PAUSE_MS = 10 * 60 * 1000;

export type CrispConversationCheck = "exists" | "none" | "unknown";

let pausedUntil = 0;
let warnedUnset = false;

/** For tests: forget a rate-limit pause and the one-time "not configured" warning. */
export function resetCrispConversationCheck(): void {
  pausedUntil = 0;
  warnedUnset = false;
}

type Fetch = typeof fetch;

class CrispUnavailable extends Error {}

function hasMessage(conversation: unknown): boolean {
  if (!conversation || typeof conversation !== "object") return false;
  const row = conversation as { last_message?: unknown; preview_message?: { excerpt?: unknown } | null };
  const last = typeof row.last_message === "string" ? row.last_message.trim() : "";
  const excerpt = typeof row.preview_message?.excerpt === "string" ? row.preview_message.excerpt.trim() : "";
  return Boolean(last || excerpt);
}

/** The session id of one List People Conversations item: a string, or an object carrying session_id. */
function sessionIdOf(item: unknown): string | null {
  if (typeof item === "string") return item.trim() || null;
  if (item && typeof item === "object" && typeof (item as { session_id?: unknown }).session_id === "string") {
    return (item as { session_id: string }).session_id;
  }
  return null;
}

async function get(config: CrispApiConfig, path: string, fetcher: Fetch, signal: AbortSignal, now: () => number): Promise<{ status: number; data: unknown }> {
  const auth = Buffer.from(`${config.identifier}:${config.key}`).toString("base64");
  const response = await fetcher(`${API}/website/${encodeURIComponent(config.websiteId)}/${path}`, {
    headers: { Authorization: `Basic ${auth}`, "X-Crisp-Tier": config.tier, Accept: "application/json" },
    signal,
  });
  if (response.status === 429 || response.status === 420) {
    pausedUntil = now() + RATE_LIMIT_PAUSE_MS;
    throw new CrispUnavailable(`rate limited (${response.status}); not asking again for ${RATE_LIMIT_PAUSE_MS / 60_000} minutes`);
  }
  if (response.status === 404) return { status: 404, data: null };
  if (!response.ok) throw new CrispUnavailable(`answered ${response.status}`);
  const body = (await response.json()) as { error?: boolean; reason?: string; data?: unknown };
  if (body.error) throw new CrispUnavailable(`error: ${body.reason ?? "unknown"}`);
  return { status: response.status, data: body.data };
}

/**
 * Whether Crisp already holds a conversation with a message in it for this
 * email. Never throws; "unknown" whenever Crisp cannot say.
 */
export async function crispConversationExists(
  email: string | null | undefined,
  options: { config?: CrispApiConfig | null; fetcher?: Fetch; now?: () => number } = {},
): Promise<CrispConversationCheck> {
  const address = email?.trim().toLowerCase();
  if (!address) return "unknown";
  const config = options.config === undefined ? crispApiConfig() : options.config;
  if (!config) {
    if (!warnedUnset) {
      warnedUnset = true;
      console.warn("[support] Crisp API not configured (CRISP_API_IDENTIFIER / CRISP_API_KEY): existing conversations are checked in this app only");
    }
    return "unknown";
  }
  const now = options.now ?? Date.now;
  if (now() < pausedUntil) return "unknown";
  const fetcher = options.fetcher ?? fetch;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const list = await get(config, `people/conversations/${encodeURIComponent(address)}/list/1`, fetcher, signal, now);
    if (list.status === 404) return "none";
    const items = Array.isArray(list.data) ? list.data : [];
    // An item that already carries the conversation answers without a second request.
    if (items.some((item) => typeof item === "object" && hasMessage(item))) return "exists";
    const sessions = items.map(sessionIdOf).filter((id): id is string => Boolean(id)).slice(0, MAX_SESSIONS);
    for (const sessionId of sessions) {
      const conversation = await get(config, `conversation/${encodeURIComponent(sessionId)}`, fetcher, signal, now);
      if (conversation.status !== 404 && hasMessage(conversation.data)) return "exists";
    }
    return "none";
  } catch (error) {
    const reason = error instanceof CrispUnavailable ? error.message : error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
    console.warn(`[support] Crisp conversation check skipped (${reason}); the welcome check goes on without it`);
    return "unknown";
  }
}
