import { ExternalLink, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFeedbackAdmin } from "@/lib/admin/feedback";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { isLocale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";

import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../../_ui/page";
import { AdminStatus } from "../../_ui/status";
import { KIND_LABEL, SOURCE_LABEL, STATUS_LABEL } from "../labels";
import { FeedbackActions } from "./feedback-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feedback" };

const when = (date: Date | string) =>
  `${formatDate(new Date(date), "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

/** One feedback message: what was sent, by whom and from where, its screenshot, its replies, and what to do with it. */
export default async function FeedbackMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const item = await getFeedbackAdmin((await params).id);
  if (!item) notFound();
  const status = STATUS_LABEL[item.status];
  const language = isLocale(item.locale) ? LANGUAGE_NAMES_EN[item.locale] : item.locale;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        back={{ href: "/admin/feedback", label: "Feedback" }}
        title={`${KIND_LABEL[item.kind]} from ${item.name || item.email}`}
        meta={<AdminStatus tone={status.tone} label={status.label} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-6">
          <AdminSection title="Message">
            <p className="text-sm whitespace-pre-wrap wrap-anywhere">{item.message}</p>
            {item.hasScreenshot ? (
              <a
                href={`/admin/feedback/${item.id}/screenshot`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 block w-fit rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- an admin-only image route, not a static asset */}
                <img src={`/admin/feedback/${item.id}/screenshot`} alt="The screenshot sent with this message" className="max-h-96 max-w-full rounded-lg" />
                <span className="sr-only">(opens the screenshot in a new tab)</span>
              </a>
            ) : null}
          </AdminSection>

          <AdminSection title="Reply and status" description={`A reply is emailed to ${item.email}, in ${language}, with their message quoted underneath.`}>
            <FeedbackActions id={item.id} status={item.status} language={language} />
          </AdminSection>

          {item.replies.length > 0 ? (
            <AdminSection title="Replies sent">
              <ol className="space-y-4">
                {item.replies.map((reply) => (
                  <li key={reply.at} className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">
                      {when(reply.at)} · {reply.by}
                      {reply.status && reply.status in STATUS_LABEL ? ` · marked ${STATUS_LABEL[reply.status as keyof typeof STATUS_LABEL].label}` : ""}
                    </p>
                    <p className="mt-2 text-sm whitespace-pre-wrap wrap-anywhere">{reply.message}</p>
                  </li>
                ))}
              </ol>
            </AdminSection>
          ) : null}
        </div>

        <AdminSection title="Details">
          <AdminFacts
            items={[
              {
                label: "From",
                value: (
                  <span className="space-y-0.5">
                    {item.name ? <span className="block">{item.name}</span> : null}
                    <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {item.email}
                    </a>
                  </span>
                ),
              },
              { label: "Sent by", value: SOURCE_LABEL[item.source] ?? item.source },
              ...(item.customer
                ? [
                    {
                      label: "Account",
                      value: (
                        <span className="space-y-0.5">
                          <Link href={`/admin/users?q=${encodeURIComponent(item.customer.email)}`} className="block underline-offset-4 hover:underline">
                            {item.customer.name}
                          </Link>
                          {item.customer.organizationName ? (
                            <Link
                              href={`/admin/organizations?q=${encodeURIComponent(item.customer.organizationName)}`}
                              className="block text-muted-foreground underline-offset-4 hover:underline"
                            >
                              {item.customer.organizationName}
                            </Link>
                          ) : null}
                        </span>
                      ),
                    },
                  ]
                : []),
              {
                label: "Page",
                value: item.pageUrl ? (
                  <a href={item.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 underline-offset-4 hover:underline">
                    {new URL(item.pageUrl).pathname || "/"}
                    <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not known</span>
                ),
              },
              { label: "Language", value: language },
              { label: "Received", value: when(item.createdAt) },
            ]}
          />
        </AdminSection>
      </div>
    </AdminPage>
  );
}
