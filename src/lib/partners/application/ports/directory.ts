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
  /** An address in the form sessions store it (an IPv6 address as its /64), for comparing networks. */
  networkKey(ipAddress: string): string;
  /** A user's most recent sessions: their network (networkKey form) and browser. Read to compare, never stored. */
  recentSessions(userId: string): Promise<{ network: string | null; userAgent: string | null }[]>;
  /** The organization paying for a Stripe customer (billing_customers). */
  organizationForStripeCustomer(customerId: string): Promise<string | null>;
  /** The organization the billing webhook recorded a Stripe invoice for (payments). */
  organizationForInvoice(invoiceId: string): Promise<string | null>;
  /**
   * Whether the organization paid real money before `before`, through any
   * provider (Stripe or PayPal) - an existing customer is never "new".
   */
  priorPaidPayments(organizationId: string, before: Date, excludingStripeInvoiceId: string): Promise<boolean>;
  /**
   * A short, privacy-safe label for a referred customer, for the PARTNER's
   * eyes: a shortened website address ("ex•••.com") or an opaque reference
   * ("Customer 3FA2C1") - never a name, an email or a full address.
   */
  customerLabels(organizationIds: string[]): Promise<Record<string, string>>;
  /** For administrators only: the workspace name and first website, with the same reference. */
  organizationSummaries(organizationIds: string[]): Promise<Record<string, { name: string; domain: string | null; reference: string }>>;
  /**
   * The RepGet plan behind Stripe prices (what a payment's invoice lines
   * charged) and, for payments recorded without a price, behind Stripe
   * subscriptions (their current plan). Unknown ids are left out.
   */
  plansFor(input: { priceIds: string[]; subscriptionIds: string[] }): Promise<{ byPrice: Record<string, PlanSummary>; bySubscription: Record<string, PlanSummary> }>;
}

/** A RepGet plan as a partner sees it in their commission history: "Grow, EUR 99/month". */
export type PlanSummary = { name: string; interval: "month" | "year"; priceCents: number; currency: string };

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
