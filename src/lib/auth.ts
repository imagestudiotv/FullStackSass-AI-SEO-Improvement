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

export const auth = betterAuth({
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
