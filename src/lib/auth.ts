import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email/otp";
import * as schema from "@/lib/db/schema";

/**
 * How long a one-time code lasts, in seconds.
 *
 * ONE constant, used by the plugin AND by the email that quotes it. Written
 * twice they drift, and the failure is a message that promises ten minutes
 * over a code that died after five — which reads as a broken product rather
 * than a stale code.
 */
const OTP_EXPIRES_IN = 10 * 60;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

/**
 * Every user needs an organization: a website is attached to one, and a null
 * active organization causes confusing failures later. Created here rather
 * than via auth.api.createOrganization, which cannot be called from inside
 * this config without making `auth` circular (and therefore `any`).
 */
export async function ensureOrganization(user: {
  id: string;
  name?: string | null;
  email: string;
}): Promise<void> {
  /*
    One transaction holding a per-user lock, so the check and the insert
    cannot interleave. Without it, two requests for a user with no workspace
    - the layout and the page render in parallel and both reach requireOrg,
    or the signup hook racing the first page load - each saw "no membership"
    and each created a workspace, leaving the customer with two. The lock is
    released when the transaction ends; the second caller then finds the
    first one's row and returns.
  */
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);

    const existing = await tx.query.member.findFirst({
      where: (member, { eq }) => eq(member.userId, user.id),
    });
    if (existing) return;

    const displayName = user.name?.trim() || user.email.split("@")[0];
    const organizationId = crypto.randomUUID();

    await tx.insert(schema.organization).values({
      id: organizationId,
      name: `${displayName}'s Workspace`,
      slug: `${slugify(displayName)}-${organizationId.slice(0, 8)}`,
      createdAt: new Date(),
    });

    await tx.insert(schema.member).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
    });
  });
}

/**
 * Better Auth instance, built on first use.
 *
 * Deferred for the same reason as the database and Stripe clients: `next
 * build` evaluates every route module to collect page data, and a
 * module-scope `required()` throw fails the whole build on any machine
 * without the secrets — a fresh Vercel deploy, CI, or a new clone. The
 * secrets are still mandatory; they are simply demanded when a request needs
 * them rather than when the file is imported.
 */
function createAuth() {
  return betterAuth({
    appName: "AI SEO Platform",
    secret: required("BETTER_AUTH_SECRET"),
    baseURL: required("BETTER_AUTH_URL"),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: required("GOOGLE_CLIENT_ID"),
        clientSecret: required("GOOGLE_CLIENT_SECRET"),
      },
    },

    /**
     * Let someone who signed up with a password also sign in with Google.
     *
     * Without this, "Continue with Google" on an address that already has a
     * password account bounced to /?error=account_not_linked and signed
     * nobody in. Better Auth refuses to attach a second provider to an
     * existing user unless the provider is trusted or the email arrives
     * verified — see the check in its oauth callback:
     *
     *   !trustedProviders.includes(provider.id) && !userInfo.emailVerified
     *
     * Trusting Google is safe here in a way trusting an arbitrary provider
     * would not be: Google verifies the mailbox itself, so proving control of
     * the Google account proves control of the address the password account
     * was opened with. The risk this check guards against — a provider that
     * lets anyone claim any email — does not apply to it.
     *
     * allowDifferentEmails stays off. Linking is only ever the SAME address;
     * a different one is a different person until they say otherwise.
     */
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    /**
     * The dashboard language, so updateUser() can write it.
     *
     * Better Auth rejects any field it does not know about, so the column
     * existing in the schema is not enough — without this the Settings
     * dropdown would save nothing and report success.
     *
     * Not `required`: an account created before this shipped has no value,
     * and resolveAppLocale treats null as "never chose" rather than an error.
     */
    user: {
      additionalFields: {
        locale: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            /**
             * Never fail signup over this.
             *
             * Better Auth runs this after the user row is committed, so a
             * throw here leaves an account that exists but cannot be used,
             * and the hook fires once and never retries. That is how a user
             * ended up with no organization and a blank page after every
             * sign-in.
             *
             * (app)/layout.tsx now creates the workspace on the next request
             * if this did not, so losing it here is recoverable rather than
             * permanent. Logged loudly because it should not happen.
             */
            try {
              await ensureOrganization(user);
            } catch (error) {
              console.error(
                "[auth] could not create a workspace at signup; the app layout will retry",
                error,
              );
            }
          },
        },
      },
    },
    plugins: [
      /**
       * One-time codes by email: sign in without a password, verify an
       * address, reset a password.
       *
       * A code rather than a magic link. A link in an email is followed by
       * corporate mail scanners, by link previews, and by whichever device
       * happens to open the message — none of which is the device trying to
       * sign in. A six-digit number typed into the page the person already
       * has open cannot be consumed by anything else.
       */
      emailOTP({
        /**
         * HASHED, not the default "plain".
         *
         * Better Auth stores the code as written unless told otherwise, so a
         * leaked database would hand over every live code — and a live code
         * is a sign-in. Hashing costs nothing here because the plugin only
         * ever compares, never reads one back.
         */
        storeOTP: "hashed",

        /**
         * Ten minutes rather than the default five.
         *
         * Long enough to find the email on a phone while sitting at a
         * laptop, short enough that a code left in an inbox is not a standing
         * key. The email says the same number — see expiresInSeconds below —
         * so the promise and the enforcement cannot drift.
         */
        expiresIn: OTP_EXPIRES_IN,

        /*
          Three tries, the default, stated because it is a security property
          rather than a detail: six digits is a million combinations, and
          without a cap an attacker holding an address could simply work
          through them.
        */
        allowedAttempts: 3,

        /**
         * Sending never throws, and that is deliberate.
         *
         * sendEmail reports failures rather than rejecting, so a provider
         * outage leaves the code issued and unsent instead of failing the
         * whole request halfway — the same rule the rest of lib/email
         * follows. Logged loudly so an unsent code is findable, because to
         * the customer it looks identical to an email that never arrived.
         */
        async sendVerificationOTP({ email, otp, type }) {
          const result = await sendOtpEmail({
            to: email,
            code: otp,
            purpose: type,
            expiresInSeconds: OTP_EXPIRES_IN,
          });

          if (!result.ok) {
            console.error("[auth] could not send one-time code", {
              type,
              error: result.error,
            });
          }
        },
      }),
      organization({
        /**
         * Customers do not create workspaces.
         *
         * A workspace is the billing container, made once at signup; websites
         * are what a customer adds, and each carries its own subscription.
         * Leaving this open let someone create a second workspace with its own
         * plan and its own credit balance — splitting their account for no
         * benefit they asked for, and undercutting per-site billing.
         *
         * Closed at the API as well as removing the button: the endpoint is
         * reachable whether or not anything renders a form for it.
         */
        allowUserToCreateOrganization: false,
      }),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

let instance: Auth | null = null;

function getAuth(): Auth {
  if (!instance) {
    instance = createAuth();
  }
  return instance;
}

/**
 * Proxy so `auth.api.getSession(...)` and `toNextJsHandler(auth)` keep working
 * unchanged while construction stays deferred to first use.
 *
 * The target is a FUNCTION, not an object literal. Better Auth's handler is
 * callable, and toNextJsHandler invokes it directly — a Proxy wrapping `{}`
 * has no [[Call]] behaviour and fails at runtime with "auth is not a
 * function", which no build or type check catches.
 */
export const auth = new Proxy(function () {} as unknown as Auth, {
  get(_target, property, receiver) {
    return Reflect.get(getAuth(), property, receiver);
  },
  has(_target, property) {
    return Reflect.has(getAuth(), property);
  },
  apply(_target, thisArg, args) {
    return Reflect.apply(
      getAuth() as unknown as (...a: unknown[]) => unknown,
      thisArg,
      args,
    );
  },
});
