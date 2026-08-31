/**
 * Sign-in and sign-up read the session to redirect a user who is already
 * logged in, so they cannot be prerendered — doing so would demand the auth
 * secrets at build time.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      {/* Product mark above the card: this is the first screen a customer
          sees, and an unbranded form looks like a generic login. */}
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          AI
        </span>
        SEO Platform
      </div>
      {children}
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        SEO that finds the search terms your customers actually use, and writes
        the pages that answer them.
      </p>
    </div>
  );
}
