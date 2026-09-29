"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * "Use a different account": signs out and comes back here through sign-in.
 * The request then belongs to the new session - the old one has signed out,
 * so nobody could finish it there (lib/plugin/handshake.ts, loadForViewer).
 */
export function SwitchAccount({ label, next }: { label: string; next: string }) {
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
        router.push(`/sign-in?next=${encodeURIComponent(next)}`);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
