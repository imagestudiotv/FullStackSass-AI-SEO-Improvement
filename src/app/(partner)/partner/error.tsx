"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { fill, partnerCopy } from "@/lib/partners/presentation/copy";

/**
 * A portal page that failed to render. Never the error's message (written for
 * a log; it can hold internal details) - a plain sentence in the partner's
 * language, the reference that ties it to the captured exception, and a retry.
 */
/** The page's language (the portal sets <html lang>), read without a server/client mismatch. */
function usePageLocale(): Locale {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const lang = document.documentElement.lang.slice(0, 2);
      return (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : "en";
    },
    () => "en",
  );
}

export default function PartnerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = usePageLocale();
  useEffect(() => {
    console.error("[partner] route error", error);
  }, [error]);
  const copy = partnerCopy(locale).portal.failure;
  return (
    <ErrorState
      title={copy.title}
      message={`${copy.body}${error.digest ? ` ${fill(copy.reference, { reference: error.digest })}` : ""}`}
      action={
        <Button onClick={reset} size="sm">
          <RefreshCw className="size-4" aria-hidden="true" />
          {copy.retry}
        </Button>
      }
    />
  );
}
