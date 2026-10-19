/**
 * What the partner program reads about RepGet's own users and workspaces,
 * owned by the rest of the app (Better Auth tables, website invitations,
 * subscriptions). Read-only.
 */

export type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  /** Read from the user row, never trusted from a session. */
  emailVerified: boolean;
  createdAt: Date;
};

export interface UserDirectory {
  findUser(userId: string): Promise<DirectoryUser | null>;
  /**
   * The address was invited to someone else's workspace or website: any
   * website invitation (pending, accepted or expired - rows are kept) or a
   * pending organization invitation.
   */
  isInvited(email: string): Promise<boolean>;
  /** The workspace this user founded at signup: an owner membership created at or after the account. */
  foundingOrganization(userId: string, userCreatedAt: Date): Promise<string | null>;
  /** The owners of a workspace (user ids). */
  ownersOf(organizationId: string): Promise<string[]>;
  /** Booleans comparing a signup's network and browser with the partner's own recent sessions. */
  sessionSignals(partnerUserId: string, signup: { ipAddress: string | null; userAgent: string | null }): Promise<{
    sharedNetwork: boolean;
    sharedDevice: boolean;
  }>;
  /** The organization paying for a Stripe customer (billing_customers). */
  organizationForStripeCustomer(customerId: string): Promise<string | null>;
  /** A short, privacy-safe label for a referred customer: the website domain, else a masked name. */
  customerLabels(organizationIds: string[]): Promise<Record<string, string>>;
}

export interface Mailer {
  sendPartnerWelcome(input: { to: string; name: string; referralUrl: string; portalUrl: string }): Promise<{ ok: boolean; error?: string }>;
  sendPartnerNotice(input: { to: string; name: string; subject: string; lines: string[]; portalUrl: string }): Promise<{ ok: boolean; error?: string }>;
}

export interface RateLimiter {
  /** True when the action is within its limits; records the attempt. */
  admit(rules: { key: string; limit: number; windowSeconds: number }[], operation: string): Promise<boolean>;
}

export interface SecureRandom {
  /** n integers, each uniformly in [0, max). */
  indexes(n: number, max: number): number[];
  /** A URL-safe token with at least 256 bits of entropy. */
  token(): string;
  uuid(): string;
}

export interface Hasher {
  sha256(value: string): string;
  /** Keyed hash for pseudonymous values (visitor identity). */
  hmac(value: string): string;
}
