import { getMessages } from "@/lib/i18n/messages";
import { BacklinkExchangeContent } from "../backlink-exchange-content";

const t = getMessages("en");

export const metadata = {
  title: t.backlinkExchange.metaTitle,
  description: t.backlinkExchange.metaDescription,
  alternates: { canonical: "/backlink-exchange" },
};

/**
 * English route. Copy lives in the dictionary so /es/backlink-exchange and the
 * rest render the same component in their own language.
 */
export default function Page() {
  return <BacklinkExchangeContent t={t} href={(path) => path} />;
}
