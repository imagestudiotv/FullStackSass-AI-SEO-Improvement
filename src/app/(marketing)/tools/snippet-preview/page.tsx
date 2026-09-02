import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SnippetForm } from "./snippet-form";

export const metadata = {
  title: "Search result preview",
  description:
    "See how your page title and description will look on Google, and whether they are long enough to be cut short. Free, no account needed.",
  alternates: { canonical: "/tools/snippet-preview" },
};

export default function SnippetPreviewPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
        <Link href="/tools">
          <ArrowLeft className="size-4" />
          All tools
        </Link>
      </Button>

      <h1 className="text-3xl font-semibold tracking-tight">
        Search result preview
      </h1>
      <p className="mt-3 text-muted-foreground">
        Type your title and description to see how they will appear on Google.
        Anything too long gets cut, and the part that gets cut is usually the
        part that would have persuaded someone to click.
      </p>

      <div className="mt-10">
        <SnippetForm />
      </div>

      {/* The tool is the point; this is a footnote, not a gate. */}
      <div className="mt-14 rounded-lg border bg-muted/30 p-6">
        <p className="font-medium">Check every page at once</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Our free website check reads your whole site and finds every page with
          a missing, duplicate or over-long title.
        </p>
        <Button asChild className="mt-4">
          <Link href="/audit">
            Check my website
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
