import { getMessages } from "@/lib/i18n/messages";
import { AffiliateContent } from "../affiliate-content";

const t = getMessages("en");

export const metadata = {
  title: t.affiliate.metaTitle,
  description: t.affiliate.metaDescription,
  alternates: { canonical: "/affiliate" },
};

/**
 * English route. Copy lives in the dictionary so /es/affiliate and the
 * rest render the same component in their own language.
 */
export default function Page() {
  return <AffiliateContent t={t} />;
}
