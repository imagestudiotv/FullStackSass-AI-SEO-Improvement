import { CheckCircle2, Share2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { FAILED_POSTS_DAYS, getSocialPosting } from "@/lib/admin/social-posting";
import { formatDate } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Social posting" };

const when = (date: Date) =>
  `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
const platformName = (platform: string) => platform.charAt(0).toUpperCase() + platform.slice(1);

/**
 * Admin -> Social posting (lib/admin/social-posting.ts): what the provider
 * paused or refused. Customers are not shown these and can post by hand.
 */
export default async function SocialPostingPage() {
  const { paused, failed } = await getSocialPosting();

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Social posting"
        description="Automatic posting the provider paused or refused. Customers are not shown these: their post or video is simply ready to post by hand. A paused account starts again when its customer switches automatic posting back on."
      />

      <AdminSection id="paused" title={`Paused by the provider (${paused.length})`} description="Connected accounts that stopped posting, latest first." bodyClassName="p-0">
        {paused.length === 0 ? (
          <AdminEmpty filtering={false} icon={CheckCircle2} noun="accounts" title="No account is paused." />
        ) : (
          <ul className="divide-y">
            {paused.map((account) => (
              <li key={account.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 font-medium wrap-anywhere">
                    {platformName(account.platform)} · {account.username}
                  </p>
                  <AdminStatus tone="warning" label="Paused" />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground wrap-anywhere">
                  <Link
                    href={`/admin/websites?q=${encodeURIComponent(account.domain)}`}
                    className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {account.domain}
                  </Link>{" "}
                  · {account.organizationName} · since {when(account.pausedAt)}
                </p>
                <p className="mt-1 text-sm wrap-anywhere">{account.reason || "No reason was given."}</p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection id="failed" title={`Not posted (${failed.length})`} description={`Posts and videos that could not go out automatically in the last ${FAILED_POSTS_DAYS} days.`} bodyClassName="p-0">
        {failed.length === 0 ? (
          <AdminEmpty filtering={false} icon={Share2} noun="posts" title="Nothing failed." />
        ) : (
          <ul className="divide-y">
            {failed.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="px-5 py-4">
                <p className="line-clamp-2 font-medium wrap-anywhere">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground wrap-anywhere">
                  {item.kind === "video" ? "Video" : `${platformName(item.platform ?? "")} post`} · {item.domain} · {when(item.at)}
                </p>
                {item.error ? <p className="mt-1 text-sm wrap-anywhere">{item.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </AdminPage>
  );
}
