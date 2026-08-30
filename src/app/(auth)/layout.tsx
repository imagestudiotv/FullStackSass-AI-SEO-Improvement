/**
 * Sign-in and sign-up read the session to redirect a user who is already
 * logged in, so they cannot be prerendered — doing so would demand the auth
 * secrets at build time.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      {children}
    </div>
  );
}
