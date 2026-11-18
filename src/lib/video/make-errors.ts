/**
 * The codes a failed make leaves on its video (video_ideas.error) when a
 * provider RepGet pays for refuses: the customer reads them in their own
 * language (t.viral.errors, Videos page), never the provider's raw answer -
 * a "You have no credits remaining" from OpenAI is about RepGet's own
 * account, and must not read as the customer's credits (client, 2026-11-18).
 * The real reason stays in the server logs and the video's cost ledger.
 *
 *  - voice_unavailable: the AI voice cannot be made until RepGet fixes its
 *    side (the account's quota or billing, its key, a request refused);
 *    trying again at once does not help, so the make fails at once;
 *  - voice_busy: the voice service is overloaded, rate limited or did not
 *    answer; the job tries again, and the customer may too a few minutes later.
 *
 * No server imports: the Videos page reads older rows' raw messages with it.
 */

export const MAKE_ERROR_CODES = ["voice_unavailable", "voice_busy"] as const;
export type MakeErrorCode = (typeof MAKE_ERROR_CODES)[number];

export type VoiceFailureReason = "quota" | "auth" | "rate_limit" | "server" | "network" | "refused";

export type VoiceFailure = {
  code: MakeErrorCode;
  reason: VoiceFailureReason;
  /** Whether trying the same call again may work (the job's retries). */
  retryable: boolean;
};

/**
 * Whether a 429 means the account is out of credit or quota, not merely
 * rate limited: OpenAI's error code says so (insufficient_quota against
 * rate_limit_exceeded); without one, its words. A rate limit's own message
 * may mention billing ("add a payment method to raise your limit"), so
 * those words alone never count.
 */
function isQuota(body: string): boolean {
  try {
    const error = (JSON.parse(body) as { error?: { code?: unknown; type?: unknown } }).error;
    const tags = [error?.code, error?.type].filter((tag): tag is string => typeof tag === "string");
    if (tags.some((tag) => /quota|billing|credit/i.test(tag))) return true;
    if (tags.some((tag) => /rate_limit/i.test(tag))) return false;
  } catch {
    // Not JSON (or cut short): the words decide.
  }
  return /insufficient_quota|exceeded your current quota|no credits|credits remaining|out of credits|credit balance/i.test(body);
}

/**
 * What a failed speech or transcription call means, from its HTTP status
 * (null: no answer - a network error or the timeout) and its body.
 */
export function classifyVoiceFailure(status: number | null, body: string): VoiceFailure {
  if (status === null) return { code: "voice_busy", reason: "network", retryable: true };
  if (status === 401 || status === 403) return { code: "voice_unavailable", reason: "auth", retryable: false };
  if (status === 402) return { code: "voice_unavailable", reason: "quota", retryable: false };
  if (status === 429) {
    return isQuota(body) ? { code: "voice_unavailable", reason: "quota", retryable: false } : { code: "voice_busy", reason: "rate_limit", retryable: true };
  }
  if (status >= 500) return { code: "voice_busy", reason: "server", retryable: true };
  // Any other refusal (a bad request, a model withdrawn) is RepGet's to fix: the same call fails again.
  return { code: "voice_unavailable", reason: "refused", retryable: false };
}

/** How lib/video/voice.ts worded a provider failure before these codes ("Text to speech failed (429): {...}"). */
const RAW_VOICE_ERROR = /^(?:Text to speech|Transcription) failed \((\d{3})\):?\s*([\s\S]*)$/;

/**
 * The code for a video's stored error: itself when it is one, the code a
 * raw voice failure stored before 2026-11-18 stands for, else null (the
 * error is shown as it is).
 */
export function makeErrorCode(error: string | null | undefined): MakeErrorCode | null {
  const text = (error ?? "").trim();
  if ((MAKE_ERROR_CODES as readonly string[]).includes(text)) return text as MakeErrorCode;
  const raw = RAW_VOICE_ERROR.exec(text);
  return raw ? classifyVoiceFailure(Number(raw[1]), raw[2]).code : null;
}
