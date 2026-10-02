"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * "Use a different account": signs out and comes back to `next` through
 * sign-in. The request then belongs to the new session - the old one has
 * signed out, so nobody could finish it there (lib/plugin/handshake.ts,
 * loadForViewer).
 *
 * SIGNS OUT FIRST, rather than being a plain link to /sign-in. The sign-in
 * page sends anyone who already has a session straight on to ?next=, so a link
 * there from a signed-in browser lands right back on the screen that said
 * "wrong account" - which is what the invitation page's "Sign in as someone
 * else" used to do.
 *
 * Shared by the WordPress connect page and the invitation page, which is why
 * it lives in components/ rather than beside either of them.
 */
export function SwitchAccount({
  label,
  next,
  email,
}: {
  label: string;
  /** Where to return after signing in. A path on this origin. */
  next: string;
  /**
   * Prefills the sign-in form when the right address is already known - an
   * invitation names the one account that can accept it, and typing another
   * produces an account that cannot.
   */
  email?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut().catch(() => undefined);
        const prefill = email ? `&email=${encodeURIComponent(email)}` : "";
        router.push(`/sign-in?next=${encodeURIComponent(next)}${prefill}`);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
