
import { BrandLogo } from "@/components/brand-logo";
import { HeaderTrailing } from "@/components/onboarding/header-trailing";
import { UserMenu } from "@/components/user-menu";
import { isAdmin } from "@/lib/admin/guard";
import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireOrg } from "@/lib/tenant";

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
  const { t } = await getAppMessages(session.user.id);

  /**
   * Administrators get a way out of the wizard.
   *
   * Everything else in this header was deliberately removed - see the note
   * above - and that is right for a customer, who should be finishing setup
   * rather than wandering into a content planner. An administrator is not a
   * customer: signing in with a fresh admin account lands here, and with no
   * link anywhere on the screen there was no way to reach /admin short of
   * typing the URL or completing a setup flow they have no reason to.
   *
   * It rides in the account menu rather than as a second header button, so
   * the wizard's chrome stays as bare as the client asked for.
   */
  const admin = await isAdmin();

  // Creates the workspace for an account that has none. See requireOrg.
  await requireOrg();

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
          <HeaderTrailing t={t.app.common} />
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
            isAdmin={admin}
            adminLabel={t.app.common.admin}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
