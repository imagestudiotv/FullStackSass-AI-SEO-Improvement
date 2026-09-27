import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { oauthStates } from "@/lib/db/schema";

/**
 * OAuth state for the Google connect flow.
 *
 * WHAT WAS WRONG. The state was an HMAC over "<websiteId>.<nonce>.<origin>".
 * That proves the value came from us, which is not the property an OAuth state
 * needs. It was replayable for ever (no expiry, no record of use), it was not
 * bound to the person or session that started the flow, and its nonce came from
 * Math.random(). Anyone holding a callback URL could redeem it repeatedly and
 * attach their own Google account to that website.
 *
 * WHAT THIS DOES INSTEAD. One row per authorization attempt, keyed by a
 * cryptographically random value, with a short expiry, consumed exactly once by
 * a conditional UPDATE, and bound to the initiating user, session and website.
 * The PKCE verifier lives here too — it must never travel through the browser.
 *
 * SEPARATE FROM AUTHORIZATION. Consuming a state proves this callback belongs
 * to a flow this person started. It says nothing about whether they may still
 * write to that website — permissions change while the customer is on Google's
 * consent screen. The callback therefore re-checks editor access after
 * consuming; see the route.
 */

/**
 * Ten minutes.
 *
 * Long enough to read a consent screen, pick a Google account and approve, on
 * a phone, with a password manager in the way. Short enough that a leaked
 * callback URL is worthless by the time it is found in a log or a referrer
 * header. The old state had no expiry at all.
 */
const TTL_SECONDS = 10 * 60;

export type ConnectOrigin = "app" | "onboarding";

export type CreatedState = {
  state: string;
  /** The S256 challenge to send to the provider. */
  codeChallenge: string;
};

/** base64url, no padding: safe in a query string without escaping. */
function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

/**
 * Starts an authorization and returns the state plus its PKCE challenge.
 *
 * 32 bytes from the CSPRNG, which is the OAuth 2.0 Security BCP's floor for a
 * value whose only job is to be unguessable. Math.random() — what this
 * replaced — is seeded predictably and is not suitable for a security token.
 */
export async function createOAuthState(input: {
  provider: string;
  websiteId: string;
  userId: string;
  sessionId: string | null;
  origin: ConnectOrigin;
  now?: Date;
}): Promise<CreatedState> {
  const now = input.now ?? new Date();
  const state = base64url(randomBytes(32));

  /**
   * PKCE, even though this is a confidential client holding a secret.
   *
   * It costs one column and closes authorization-code injection: an attacker
   * who obtains a code cannot redeem it without the verifier, which never
   * leaves this server. Google supports S256 for web server flows, and the
   * spec-recommended verifier length is 43-128 characters — 32 random bytes
   * base64url-encoded is 43.
   */
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest(),
  );

  await db.insert(oauthStates).values({
    state,
    provider: input.provider,
    websiteId: input.websiteId,
    userId: input.userId,
    sessionId: input.sessionId,
    origin: input.origin,
    codeVerifier,
    expiresAt: new Date(now.getTime() + TTL_SECONDS * 1000),
  });

  /**
   * Opportunistic cleanup, on the write path rather than in a cron.
   *
   * This flow runs a handful of times per customer, so a sweep here keeps the
   * table from growing without adding a scheduled job to maintain. Failure is
   * ignored: tidying is not worth failing a connection the customer started.
   */
  void pruneOAuthStates(now).catch(() => {});

  return { state, codeChallenge };
}

export type ConsumedState = {
  websiteId: string;
  userId: string;
  sessionId: string | null;
  origin: ConnectOrigin;
  codeVerifier: string | null;
};

export type ConsumeResult =
  | { ok: true; state: ConsumedState }
  /**
   * Deliberately one reason for every failure mode.
   *
   * Unknown, already used, expired and belonging-to-someone-else are reported
   * identically. Distinguishing them tells whoever is probing which of those
   * they hit, and the caller's only sensible response is the same in all four
   * cases: refuse and send them back to press Connect again.
   */
  | { ok: false; reason: "invalid" };

/**
 * Redeems a state exactly once.
 *
 * SINGLE-USE IS THE CONDITIONAL UPDATE, not a read followed by a write. Two
 * callbacks arriving together both see an unconsumed row if you SELECT first,
 * and both proceed. Here the UPDATE itself carries `consumed_at is null` and
 * the expiry, so Postgres serialises them and exactly one gets a row back —
 * the same shape as convertReferral's pending-row guard.
 *
 * The user and session are matched in the same statement rather than compared
 * afterwards, so a state belonging to another session is not merely rejected,
 * it is not consumed either — a forwarded URL cannot burn somebody else's
 * pending authorization.
 */
export async function consumeOAuthState(input: {
  state: string;
  provider: string;
  userId: string;
  sessionId: string | null;
  now?: Date;
}): Promise<ConsumeResult> {
  const now = input.now ?? new Date();

  /**
   * An empty or absurd state never reaches the database. A primary-key lookup
   * on attacker-supplied text is cheap, but there is no reason to make it.
   */
  if (!input.state || input.state.length > 512) {
    return { ok: false, reason: "invalid" };
  }

  const [row] = await db
    .update(oauthStates)
    .set({ consumedAt: now })
    .where(
      and(
        eq(oauthStates.state, input.state),
        eq(oauthStates.provider, input.provider),
        eq(oauthStates.userId, input.userId),
        isNull(oauthStates.consumedAt),
        /*
          Strictly in the future. A row expiring this instant is treated as
          expired rather than racing the clock. Column first: drizzle's
          comparison helpers take the column as their left operand.
        */
        gt(oauthStates.expiresAt, now),
        /*
          A row written before session binding existed has a null session and
          is matched on the user alone; otherwise the session must be the one
          that started the flow. Signing out and back in produces a new
          session id, so that state is correctly refused.
        */
        input.sessionId
          ? or(
              isNull(oauthStates.sessionId),
              eq(oauthStates.sessionId, input.sessionId),
            )
          : isNull(oauthStates.sessionId),
      ),
    )
    .returning({
      websiteId: oauthStates.websiteId,
      userId: oauthStates.userId,
      sessionId: oauthStates.sessionId,
      origin: oauthStates.origin,
      codeVerifier: oauthStates.codeVerifier,
    });

  if (!row) return { ok: false, reason: "invalid" };

  return {
    ok: true,
    state: {
      websiteId: row.websiteId,
      userId: row.userId,
      sessionId: row.sessionId,
      origin: row.origin === "onboarding" ? "onboarding" : "app",
      codeVerifier: row.codeVerifier,
    },
  };
}

/**
 * Deletes expired rows, and consumed ones once they can no longer be replayed.
 *
 * A consumed row is kept until its original expiry so that a duplicate
 * delivery within the window is refused by `consumed_at is null` rather than
 * by the row being absent — same answer either way, but it keeps the reason
 * legible while debugging.
 */
export async function pruneOAuthStates(now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(oauthStates)
    .where(lt(oauthStates.expiresAt, now))
    .returning({ state: oauthStates.state });
  return deleted.length;
}
