"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The client plugin list must mirror the server plugin list in src/lib/auth.ts.
 * A mismatch surfaces as opaque network-looking errors.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
