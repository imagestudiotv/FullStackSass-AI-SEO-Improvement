import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { SnippetForm } from "./snippet-form";

export const metadata = {
  title: "SEO Title Checker",
  description:
    "See how your page title and description will look on Google, and whether they are long enough to be cut short. Free, no account needed.",
  alternates: { canonical: "/tools/snippet-preview" },
};

const HREF = "/tools/snippet-preview";

export default function SnippetPreviewPage() {
  return (
    <div>
      <ToolHero
        title="SEO Title Checker"
        description="Type your title and description to see exactly how they will appear on Google. Anything too long gets cut, and the part that gets cut is usually the part that would have persuaded someone to click."
      >
        <SnippetForm />
      </ToolHero>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "Your title and description are measured against the lengths Google actually truncates at, and the preview updates as you type. Nothing is sent anywhere — this one runs entirely in your browser.",
          },
          {
            heading: "Why the order matters",
            body: "Truncation always takes the end. Put what distinguishes you first and your brand name last: a title reading \"Emergency plumber, open 24/7 — Acme\" survives the cut where \"Acme — the trusted name in…\" loses everything that would have earned the click.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Check every page at once"
        body="Our free website check reads your whole site and finds every page with a missing, duplicate or over-long title."
      />
    </div>
  );
}
