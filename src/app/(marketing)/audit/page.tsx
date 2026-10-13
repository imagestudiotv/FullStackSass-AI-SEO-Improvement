import { AuditPageContent, auditMetadata } from "./audit-page";

export const metadata = auditMetadata("en");

// Crawls a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

/** The free website check (audit-page.tsx); other languages: [locale]/audit. */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  return <AuditPageContent locale="en" searchParams={await searchParams} />;
}
