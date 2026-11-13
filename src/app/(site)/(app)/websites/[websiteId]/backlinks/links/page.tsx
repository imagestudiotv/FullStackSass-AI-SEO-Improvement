import { LinksPage } from "../links-page";

export const metadata = { title: "Earned Backlinks" };
export const dynamic = "force-dynamic";

/** Links RECEIVED by this website ("Earned Backlinks" - not credits earned by hosting). */
export default async function EarnedBacklinksPage({
  params,
  searchParams,
}: PageProps<"/websites/[websiteId]/backlinks/links">) {
  const { websiteId } = await params;
  return <LinksPage direction="received" websiteId={websiteId} searchParams={await searchParams} />;
}
