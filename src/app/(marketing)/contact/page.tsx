import { SUPPORT_EMAIL } from "@/lib/config/site";
import { getMessages } from "@/lib/i18n/messages";
import { ContactContent } from "../static-pages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

const t = getMessages("en");

export const metadata = {
  title: t.contact.metaTitle,
  description: t.contact.metaDescription,
  ...publicPageMetadata("/contact"),
};

/**
 * Contact page: the support address, and the feedback form (lib/feedback,
 * 2026-10-19), which has its own limits, spam checks and delivery to the
 * administrators. Questions still go to the address.
 */
export default async function ContactPage({
  searchParams,
}: PageProps<"/contact">) {
  /**
   * Billing links here with ?about=audit_fix when someone asks for a quote on
   * a service we price by hand. Without acknowledging it the page would look
   * like a plain contact page, and the person would have to explain from
   * scratch what they had just clicked.
   */
  const params = await searchParams;
  const quote = params.about === "audit_fix";

  return (
    <ContactContent
      t={t}
      locale="en"
      supportEmail={SUPPORT_EMAIL}
      subject={
        quote
          ? "Quote for fixing my website errors"
          : "Question about RepGet"
      }
      title={quote ? "Ask us to fix it for you" : undefined}
      subtitle={
        quote
          ? "Send us your website address and we will look at what the audit found, tell you what it takes to fix, and quote a price before doing any work."
          : undefined
      }
    />
  );
}
