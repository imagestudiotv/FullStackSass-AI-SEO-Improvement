import { listPlansForPrebuiltPage } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { AI_BLOG_WRITER_PATH, aiBlogWriterCopy } from "@/lib/i18n/ai-blog-writer";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { AiBlogWriterPageContent } from "../ai-blog-writer-page";

const t = aiBlogWriterCopy("en");

export const metadata = {
  title: t.metaTitle,
  description: t.metaDescription,
  ...publicPageMetadata(AI_BLOG_WRITER_PATH),
};

/**
 * Built ahead and refreshed in the background at most hourly, like the
 * homepage: the plan prices in its pricing teaser are its only data
 * (lib/billing.ts listPlansForPrebuiltPage: none without a database).
 */
export const revalidate = 3600;

/** The AI Blog Writer product page (ai-blog-writer-page.tsx). Other languages: [locale]/ai-blog-writer. */
export default async function Page() {
  const plans = await listPlansForPrebuiltPage();
  return <AiBlogWriterPageContent plans={plans} offer={repgetOfferEnabled()} />;
}
