import { SUPPORT_EMAIL } from "@/lib/config/site";
import { getMessages } from "@/lib/i18n/messages";
import { ContactContent } from "../static-pages";

const t = getMessages("en");

export const metadata = {
  title: t.contact.metaTitle,
  description: t.contact.metaDescription,
};

/**
 * Contact page.
 *
 * Deliberately an email address rather than a contact form. A form needs a
 * backend endpoint, spam handling and a delivery mechanism — none of which
 * exist yet, and a form that silently fails is worse than no form.
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
      supportEmail={SUPPORT_EMAIL}
      subject={
        quote
          ? "Quote for fixing my website errors"
          : "Question about AI SEO Platform"
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
