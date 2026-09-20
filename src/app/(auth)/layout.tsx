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
      {/*
        Form side. Sticky on a wide screen so it stays put while the showcase
        beside it scrolls — the form is why anyone is on this page, and it
        should not have to be scrolled back to.

        NOT `justify-center`. Centred flex content that overflows is pushed out
        past the container's START edge, and that overflow cannot be scrolled
        back to — setting scrollTop to 0 does not help, because the content
        begins at a negative offset. On a 700px-tall laptop the logo sat at
        -25px and the "Create your account" line was cut in half; at 560px the
        logo was 95px above the top. Adding overflow-y-auto did not fix it,
        which is what proved the centring itself was the cause.

        `my-auto` on the inner block centres it the safe way: auto margins
        collapse to zero once there is no spare room, so short content sits in
        the middle of the viewport and tall content simply starts at the top
        and scrolls normally.
      */}
      <div className="flex flex-col px-6 py-12 sm:px-12 lg:sticky lg:top-0 lg:max-h-svh lg:overflow-y-auto lg:px-16">
        <div className="mx-auto my-auto w-full max-w-sm">
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
