"use client";

import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/config/site";

/**
 * Requesting a quote to have the audit issues fixed.
 *
 * The brief: "they send a request and we review all errors and provide the
 * price for fixing." The price depends on what is actually wrong, so there is
 * nothing to charge up front — this opens an email with the details already
 * filled in rather than pretending a fixed price exists.
 *
 * An email rather than a form because the reply is the product. A form would
 * add a table, an admin screen and a notification for something a person has
 * to read and answer by hand anyway.
 */
export function FixRequest({
  domain,
  issueCount,
  criticalCount,
  developerCount,
}: {
  domain: string;
  issueCount: number;
  criticalCount: number;
  /** How many of the problems realistically need a developer. */
  developerCount: number;
}) {
  if (issueCount === 0) return null;

  const subject = `Fix request for ${domain}`;
  const body = [
    `Hello,`,
    ``,
    `Please quote for fixing the problems found on ${domain}.`,
    ``,
    `${issueCount} ${issueCount === 1 ? "problem" : "problems"} found, ${criticalCount} serious.`,
    ``,
    `Thank you.`,
  ].join("\n");

  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <Wrench className="size-4" aria-hidden="true" />
            Want us to fix these for you?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {/*
              Says when they do NOT need us. A list that is mostly copy edits
              is one they can do in an afternoon, and telling them so is worth
              more than a sale they would resent.
            */}
            {developerCount === 0
              ? "Most of these are text changes you can make yourself using the notes above. If you would rather not, send us the list and we will quote."
              : `${developerCount} of these usually need whoever built your site. Send us the list and we will review everything and quote for fixing it.`}
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={href}>Request a quote</a>
        </Button>
      </div>
    </div>
  );
}
