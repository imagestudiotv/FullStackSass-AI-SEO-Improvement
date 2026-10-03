import { Building2, ClipboardCheck, Clock, Globe } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { getAdminArticle } from "@/lib/admin/actions";
import { partnerLinkUrls } from "@/lib/backlinks/partner-links";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader, AdminSection } from "../../_ui/page";
import { AdminStatus } from "../../_ui/status";
import { ArticleStatus } from "../article-status";
import { AdminArticleEditor } from "./admin-article-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Article" };

/** Article ids are uuids; anything else is a page that does not exist, not a database error. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const n = (value: number) => formatNumber(value, "en");
const dayAndTime = (value: Date) =>
  `${formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

const metaLink =
  "rounded text-foreground underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring";

export default async function AdminArticlePage({
  params,
}: PageProps<"/admin/articles/[articleId]">) {
  const { articleId } = await params;
  if (!UUID.test(articleId)) notFound();

  // Guarded read first: partnerLinkUrls has no admin check of its own.
  const article = await getAdminArticle(articleId);

  if (!article) {
    notFound();
  }

  const partnerLinks = await partnerLinkUrls(article.id);

  return (
    <AdminPage>
      <AdminPageHeader
        back={{ href: "/admin/articles", label: "Articles" }}
        title={article.title || "Untitled article"}
        description={
          article.underReview
            ? "In the Partner Network review: read it here, and edit it on its review page."
            : "Read the article as it stands, or edit it as an administrator."
        }
        meta={
          <>
            <ArticleStatus status={article.status} />
            {article.underReview ? (
              <AdminStatus tone="info" icon={ClipboardCheck} label="In Partner Network review" />
            ) : null}
            <MetaItem icon={<Building2 className="size-3.5" />} label="Customer">
              <Link
                href={`/admin/articles?org=${encodeURIComponent(article.organizationId)}`}
                title="Show this customer's articles"
                className={metaLink}
              >
                {article.organizationName}
              </Link>
            </MetaItem>
            <MetaItem icon={<Globe className="size-3.5" />} label="Website">
              <Link
                href={`/admin/websites?q=${encodeURIComponent(article.domain)}`}
                title="Find this website"
                className={metaLink}
              >
                {article.domain}
              </Link>
            </MetaItem>
            <MetaItem icon={<Clock className="size-3.5" />}>
              <time dateTime={article.updatedAt.toISOString()} className="tabular-nums">
                Updated {dayAndTime(article.updatedAt)}
              </time>
            </MetaItem>
          </>
        }
        actions={
          article.underReview ? (
            <Button asChild>
              <Link href={`/admin/network/${article.id}`}>
                <ClipboardCheck className="size-4" aria-hidden="true" />
                Open the review page
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <AdminArticleEditor article={article} partnerLinks={partnerLinks} />

        <AdminSection
          title="Details"
          description="As last saved."
          className="xl:sticky xl:top-20"
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <Fact label="Target keyword">
              {article.targetKeyword || <span className="text-muted-foreground">None</span>}
            </Fact>
            <Fact label="Words">
              <span className="tabular-nums">
                {article.wordCount === null ? <span className="text-muted-foreground">-</span> : n(article.wordCount)}
              </span>
            </Fact>
            <Fact label="Partner Network links" hint={partnerLinks.length > 0 ? "Highlighted wherever they appear in the text." : undefined}>
              {partnerLinks.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <span className="tabular-nums">
                  {n(partnerLinks.length)} {partnerLinks.length === 1 ? "link address" : "link addresses"}
                </span>
              )}
            </Fact>
            <Fact label="Meta description" hint="Shown for reference; it is not edited here.">
              {article.metaDescription || <span className="text-muted-foreground">None</span>}
            </Fact>
          </dl>
        </AdminSection>
      </div>
    </AdminPage>
  );
}

/** One fact in the header's meta row. `label` is for screen readers when the value alone does not say what it is. */
function MetaItem({ icon, label, children }: { icon: ReactNode; label?: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {label ? <span className="sr-only">{label}: </span> : null}
      {children}
    </span>
  );
}

function Fact({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 wrap-anywhere">{children}</dd>
      {hint ? <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
