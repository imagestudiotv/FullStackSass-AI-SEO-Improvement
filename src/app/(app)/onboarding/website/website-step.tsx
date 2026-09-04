"use client";

import { Globe, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWebsite } from "@/lib/websites/actions";

/**
 * The website input.
 *
 * Adding the site also queues the analysis job, so the next screen has
 * something to show. It sends the customer straight on rather than waiting for
 * the crawl — the profile step handles the "still working" state, and holding
 * someone on a spinner for two minutes is worse than showing them progress
 * somewhere useful.
 */
export function WebsiteStep() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pasted address routinely carries a trailing space.
    const url = value.trim();
    if (!url) return;

    setPending(true);
    const result = await addWebsite(url);

    if (!result.ok) {
      setPending(false);
      toast.error(result.error);
      return;
    }

    router.push("/onboarding/profile");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6">
      <Label htmlFor="site-url" className="text-sm font-medium">
        Your website address
      </Label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Globe
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="site-url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="yourbusiness.com"
            autoComplete="url"
            disabled={pending}
            className="h-11 pl-9"
            required
            autoFocus
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-11 rounded-full px-6"
          disabled={pending || !value.trim()}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting…
            </>
          ) : (
            "Start the audit"
          )}
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Enter the address customers visit. We follow links from there, so there
        is no need to list every page.
      </p>
    </form>
  );
}
