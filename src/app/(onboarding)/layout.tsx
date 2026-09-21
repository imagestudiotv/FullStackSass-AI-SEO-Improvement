
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
          The lockup with its tagline beneath, as the reference draws it.

          The tagline is a line-height-tight second row rather than part of
          the image, so it stays crisp, translates, and can be dropped at
          narrow widths where it would crowd the account menu.
        */}
        <div className="flex flex-col gap-0.5">
          <BrandLogo height={22} priority />
          <span className="hidden text-[9px] leading-none font-medium tracking-[0.16em] text-muted-foreground uppercase sm:block">
            AI visibility for real growth
          </span>
        </div>

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
