import { describe, expect, it } from "vitest";

import { classifyVoiceFailure, makeErrorCode } from "./make-errors";

/**
 * A failed AI voice is shown to the customer as a code with words in their
 * language, never the provider's answer (client, 2026-11-18: a card showed
 * OpenAI's "You have no credits remaining" JSON).
 */

/** What the client's card showed, as failMaking stored it (whitespace collapsed, cut at 300). */
const CLIENT_CARD =
  'Text to speech failed (429): { "error": { "message": "You have no credits remaining. Add credits to continue using the API: https://platform.openai.com/account/billing", "type": "insufficient_quota", "param": null, "code": "insufficient_quota" } }';

describe("a failed AI voice call", () => {
  it("is RepGet's own account out of quota or credit: unavailable, not tried again", () => {
    expect(classifyVoiceFailure(429, JSON.stringify({ error: { message: "You exceeded your current quota.", type: "insufficient_quota", code: "insufficient_quota" } }))).toEqual({
      code: "voice_unavailable",
      reason: "quota",
      retryable: false,
    });
    // Cut short (not JSON any more): the words still say so.
    expect(classifyVoiceFailure(429, '{ "error": { "message": "You have no credits remaining. Add cred').code).toBe("voice_unavailable");
    expect(classifyVoiceFailure(402, "")).toEqual({ code: "voice_unavailable", reason: "quota", retryable: false });
  });

  it("is a rate limit: busy, tried again - even when its message mentions billing", () => {
    const limit = JSON.stringify({
      error: {
        message: "Rate limit reached for gpt-4o-mini-tts on requests per min (RPM). Add a payment method to your account to increase your rate limit. Visit https://platform.openai.com/account/billing",
        type: "requests",
        code: "rate_limit_exceeded",
      },
    });
    expect(classifyVoiceFailure(429, limit)).toEqual({ code: "voice_busy", reason: "rate_limit", retryable: true });
    expect(classifyVoiceFailure(429, "Too Many Requests").code).toBe("voice_busy");
  });

  it("is a bad key, a refused request, an outage or no answer", () => {
    expect(classifyVoiceFailure(401, "Incorrect API key provided")).toEqual({ code: "voice_unavailable", reason: "auth", retryable: false });
    expect(classifyVoiceFailure(403, "")).toMatchObject({ code: "voice_unavailable", reason: "auth" });
    expect(classifyVoiceFailure(400, "Invalid voice")).toEqual({ code: "voice_unavailable", reason: "refused", retryable: false });
    expect(classifyVoiceFailure(500, "")).toEqual({ code: "voice_busy", reason: "server", retryable: true });
    expect(classifyVoiceFailure(503, "")).toMatchObject({ code: "voice_busy", retryable: true });
    expect(classifyVoiceFailure(null, "The operation was aborted due to timeout")).toEqual({ code: "voice_busy", reason: "network", retryable: true });
  });
});

describe("a video's stored error", () => {
  it("is read as its code, and an older raw voice failure as the code it stands for", () => {
    expect(makeErrorCode("voice_unavailable")).toBe("voice_unavailable");
    expect(makeErrorCode("voice_busy")).toBe("voice_busy");
    expect(makeErrorCode(CLIENT_CARD)).toBe("voice_unavailable");
    expect(makeErrorCode("Transcription failed (503): upstream error")).toBe("voice_busy");
  });

  it("leaves anything else as it is", () => {
    expect(makeErrorCode("The render machine stopped")).toBeNull();
    expect(makeErrorCode("no_accounts")).toBeNull();
    expect(makeErrorCode(null)).toBeNull();
    expect(makeErrorCode("")).toBeNull();
  });
});
