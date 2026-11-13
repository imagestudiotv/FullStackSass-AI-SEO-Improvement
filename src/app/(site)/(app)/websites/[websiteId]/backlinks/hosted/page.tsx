import { LinksPage } from "../links-page";

export const metadata = { title: "Hosted links" };
export const dynamic = "force-dynamic";

/** Links this website HOSTS for Partner Network members - the ones that earn credits. */
export default async function HostedLinksPage({
  params,
  searchParams,
}: PageProps<"/websites/[websiteId]/backlinks/hosted">) {
  const { websiteId } = await params;
  return <LinksPage direction="given" websiteId={websiteId} searchParams={await searchParams} />;
}
