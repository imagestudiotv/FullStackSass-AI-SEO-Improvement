import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { AuthShowcase } from "@/components/auth-showcase";

/**
 * Sign-in and sign-up, following the reference design: the form on the left,
 * a rotating panel on the right.
 *
 * The panel collapses below lg. On a phone it would push the form below the
 * fold, and the form is the only reason anyone is on this page.
 *
 * Sign-in and sign-up read the session to redirect a user who is already
 * logged in, so they cannot be prerendered — doing so would demand the auth
 * secrets at build time.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Form side. */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/*
            The mark links home. This is often the first page a customer sees,
            and a logo that goes nowhere is a dead end on a page with no nav.
          */}
          <Link href="/" aria-label="RepGet home" className="mb-10 inline-flex">
            <BrandLogo height={30} priority />
          </Link>

          {children}
        </div>
      </div>

      <AuthShowcase />
    </div>
  );
}
