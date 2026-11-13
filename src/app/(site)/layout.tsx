import { ROOT_METADATA, RootDocument } from "../root-document";

/**
 * Root layout of everything that is not a public marketing page: the app,
 * onboarding, admin, the partner portal, sign-in and sign-up, invitations,
 * the WordPress connect screen and the unsubscribe page. All in English, and
 * all in one root so moving between them stays an in-app navigation. See
 * app/root-document.tsx for why the site has three root layouts.
 */
export const metadata = ROOT_METADATA;

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
