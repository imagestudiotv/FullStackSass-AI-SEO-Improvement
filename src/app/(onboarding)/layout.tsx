
import { BrandLogo } from "@/components/brand-logo";
import { HeaderTrailing } from "@/components/onboarding/header-trailing";
import { UserMenu } from "@/components/user-menu";
import { ensureOrganization } from "@/lib/auth";
import { requireSession } from "@/lib/auth-guard";
import { NoOrganizationError, requireOrg } from "@/lib/tenant";

/**
 * Setup runs without the dashboard around it.
 *
 * The client asked for this directly: "still to not include the dashboard for
 * these steps. I suggest to include it on the main end when onboarding is
 * complete and payment made … So we focus to grab attention only to complete
 * the steps instead of clicking by mistake on some dashboard option."
 *
 * That is why /onboarding moved out of the (app) group. It is not a cosmetic
 * change: the sidebar there links to a content planner, a publishing screen
 * and a backlink exchange, none of which do anything useful for a customer who
 * has not finished setting up or paid — and every one of them is a way to
 * wander out of the flow and not come back.
 *
 * WHAT IS KEPT: the logo (which goes nowhere — see below) and the account
 * menu, so someone can sign out or switch account. Everything else is gone.
 *
 * WHY THE AUTH CODE IS REPEATED FROM (app)/layout.tsx: a route group's layout
 * does not inherit from a sibling group's. Leaving it out would make these
 * pages the only authenticated screens in the product that never check a
 * session — and they are the ones that create websites and start checkouts.
 */
export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  /**
   * Recover a signed-in user who has no organization.
   *
   * Same recovery as the app layout, and needed more here than there: this is
   * the first screen after signing up, so an account whose creation hook lost
   * its database write would hit it before anything else. A LAYOUT that throws
   * cannot be caught by error.tsx in its own segment, so without this the
   * customer's first sight of the product is a blank browser error page.
   */
  try {
    await requireOrg();
  } catch (error) {
    if (!(error instanceof NoOrganizationError)) throw error;
    await ensureOrganization(session.user);
    // Once. A second failure is a real fault and must surface, not loop.
    await requireOrg();
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center gap-3 px-5 sm:px-8">
        {/*
          The logo is not a link.

          Everywhere else it goes to the dashboard, which is exactly where this
          flow is trying not to send people — and it is the most-clicked way
          out of a wizard. Rendered as a plain mark, it still tells the
          customer whose product they are in.
        */}
        {/*
          The mark alone. NO TAGLINE — that was a mistake worth recording.

          The reference shows "AI VISIBILITY FOR REAL GROWTH" under the
          wordmark, so it was added here as a second row. The arithmetic makes
          it unworkable at this size: the lockup renders 88px wide at
          height 22, while 29 letterspaced characters need roughly 193px, so
          the tagline came out more than twice the width of the logo it was
          meant to sit under. The result reads as a caption that has swallowed
          the brand rather than a lockup.

          Shrinking it does not rescue it. To match an 88px logo the type
          would have to be about 4.5px, and even at a 36px logo — far too tall
          for a 64px header — it would need 7.3px. Both are past legibility,
          so the only honest options were an illegible tagline, an
          out-of-proportion one, or none.

          The reference can carry it because its header is taller and its
          lockup much wider. Ours is a compact setup header where the mark
          alone does the job the tagline was there for: telling the customer
          whose product they are in.

          If the tagline is genuinely wanted, the fix is a wider lockup image
          with the tagline baked in and kerned by a designer — not two rows of
          live text fighting for the same width.
        */}
        <BrandLogo height={22} priority />

        <div className="ml-auto flex items-center gap-2">
          {/*
            A way out that is not the dashboard — except on the plan step,
            where it becomes the checkout reassurance. See header-trailing.
          */}
          <HeaderTrailing />
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
