"use client";

import {
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

/**
 * The client plugin list must mirror the server plugin list in src/lib/auth.ts.
 * A mismatch surfaces as opaque network-looking errors.
 *
 * inferAdditionalFields carries the server's extra user columns — currently
 * `locale` — into the client's types, so updateUser({ locale }) type-checks.
 * Inferred from the server config rather than re-declared, so adding a field
 * in one place cannot leave the two disagreeing.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient(), inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
