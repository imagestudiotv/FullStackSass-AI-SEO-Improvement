"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  name: string;
  email: string;
  image?: string | null;
  /**
   * Whether to offer the admin area.
   *
   * Resolved on the SERVER by the layout that renders this menu, because
   * isAdmin() reads ADMIN_EMAILS - a server-only value that must never reach
   * the browser. False by default so a caller that forgets to pass it hides
   * the link rather than showing one that 404s.
   *
   * This is a convenience, not a boundary: /admin re-checks on every request
   * and returns 404 to everyone else. Passing true here gets a non-admin
   * nothing but a broken link.
   */
  isAdmin?: boolean;
  /**
   * The word for the admin entry, already in the reader's language.
   *
   * Passed in rather than hardcoded: every other string in this header comes
   * from the dictionary, and "Admin" was the one English word left on a
   * German or Spanish screen. Defaulted so the prop stays optional for
   * callers that never show the entry.
   */
  adminLabel?: string;
};

/**
 * The account menu, in every authenticated header.
 *
 * WHY THE ADMIN LINK LIVES HERE: it used to sit in the (app) layout's header
 * only, so it vanished the moment an administrator was anywhere else - and
 * signing in with a fresh admin account goes straight to /onboarding, which
 * is a different route group with a deliberately stripped header. The effect
 * was that an admin could not reach /admin at all until they had finished
 * the setup wizard, which is the one thing an administrator has no reason to
 * do.
 *
 * This menu is rendered by BOTH layouts, so putting it here fixes every
 * authenticated screen at once and keeps working for any route group added
 * later.
 */
export function UserMenu({
  name,
  email,
  image,
  isAdmin = false,
  adminLabel = "Admin",
}: UserMenuProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || email[0]?.toUpperCase();

  async function handleSignOut() {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      setPending(false);
      toast.error(error.message ?? "Could not sign out");
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
          <Avatar className="size-7">
            {image ? <AvatarImage src={image} alt={name} /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          Above Sign out, and separated from it. The two are the only items
          here, and putting a navigation directly beside the control that ends
          the session invites the wrong click.
        */}
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck className="size-4" />
                {adminLabel}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={handleSignOut} disabled={pending}>
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
