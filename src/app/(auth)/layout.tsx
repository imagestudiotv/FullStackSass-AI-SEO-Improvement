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
        Form side.

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
      <div
        /*
          THE KEY: this element is no longer its own scroll container.

          It was `lg:max-h-svh lg:overflow-y-auto`, which made the form column
          scroll independently of the window. Next scrolls the WINDOW to the
          top on navigation — and the window had never moved, so moving
          between sign-in and sign-up left this column exactly where it was,
          with the logo and heading scrolled off above. The client hit it
          twice: "from sign up to sign in, and sign in to sign up is not
          showing the full body logo".

          Without the overflow the page scrolls as one document, which is
          what Next's scroll restoration already handles correctly. `sticky`
          goes with it: a sticky element inside a normally-scrolling page
          would pin the form while the showcase moved, which is not what the
          design asks for on a page this short.
        */
        id="auth-form-column"
        className="flex flex-col px-6 py-12 sm:px-12 lg:px-16"
      >
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
