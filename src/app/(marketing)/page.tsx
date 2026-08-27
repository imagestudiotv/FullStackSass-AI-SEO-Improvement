import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        AI-powered SEO and content automation
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Connect your website, get an automated SEO strategy, and publish
        optimised content on a schedule.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild>
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </section>
  );
}
