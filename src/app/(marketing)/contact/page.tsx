import { Mail } from "lucide-react";

export const metadata = {
  title: "Contact",
  description: "How to get in touch with AI SEO Platform.",
};

/**
 * Contact page.
 *
 * Deliberately an email address rather than a contact form. A form needs a
 * backend endpoint, spam handling and a delivery mechanism — none of which
 * exist yet, and a form that silently fails is worse than no form.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        Questions about the product, your account, or billing — we read every
        message and reply within two working days.
      </p>

      <div className="mt-8 rounded-lg border bg-background p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Mail className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">Email</p>
            <a
              href="mailto:support@example.com"
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              support@example.com
            </a>
            <p className="mt-2 text-sm text-muted-foreground">
              If you are writing about your account, please send it from the
              address you signed up with.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
