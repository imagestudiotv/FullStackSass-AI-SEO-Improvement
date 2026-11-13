import type { Metadata } from "next";

import { getSiteBannerAdmin } from "@/lib/admin/site-banner";
import { formatDate } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { BannerForm } from "./banner-form";

export const metadata: Metadata = { title: "Site banner" };

/**
 * Admin -> Site banner (client, 2026-11-11): the offer bar above the public
 * site's header, with a countdown and a link to the pricing page, changed
 * for each holiday. Rules: lib/promo-banner/banner.ts.
 */
export default async function AdminBannerPage() {
  const banner = await getSiteBannerAdmin();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Site banner"
        description="The coloured bar above the header on every public page: your offer, an optional countdown, and a link to the pricing page in the visitor's language. Saving updates every page at once."
        meta={
          banner.updatedAt ? (
            <span>
              Last changed {formatDate(banner.updatedAt, "en", { day: "numeric", month: "short", year: "numeric" })}
              {banner.updatedBy ? ` by ${banner.updatedBy}` : ""}
            </span>
          ) : (
            <span>Nothing saved yet: no banner is shown.</span>
          )
        }
      />

      <BannerForm
        enabled={banner.enabled}
        tone={banner.tone}
        endsAt={banner.endsAt?.toISOString() ?? null}
        copy={banner.copy}
      />
    </AdminPage>
  );
}
