import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

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
  const existing = await db.query.member.findFirst({
    where: (member, { eq }) => eq(member.userId, user.id),
  });
  if (existing) return;

  const displayName = user.name?.trim() || user.email.split("@")[0];
  const organizationId = crypto.randomUUID();

  await db.insert(schema.organization).values({
    id: organizationId,
    name: `${displayName}'s Workspace`,
    slug: `${slugify(displayName)}-${organizationId.slice(0, 8)}`,
    createdAt: new Date(),
  });

  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId: user.id,
    role: "owner",
    createdAt: new Date(),
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
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureOrganization(user);
          },
        },
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
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
