"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice } from "@/components/workspace/notice";
import { regenerateGeoPrompts } from "@/lib/geo/actions";
import type { GeoMethod } from "@/lib/geo/shared";
import { format, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";

type GeoText = Messages["app"]["geo"];

/**
 * "Regenerate questions": the questions written again in the website's
 * article language, from its content plan (lib/geo/regenerate.ts).
 *
 * Offered, never done for the customer: an existing website's English
 * questions are replaced only when someone presses this. The notice above
 * the list says when the questions we suggested are not in the website's
 * language (`rewrite`). The dialog keeps the customer's own questions unless
 * they choose to replace all.
 */
export function RegenerateQuestions({
  websiteId,
  rewrite,
  method,
  disabled,
  locale,
  onError,
  t,
  cancel,
  close,
}: {
  websiteId: string;
  /** Suggested questions not in the website's language (lib/geo/market.ts questionsToRewrite). */
  rewrite: number;
  method: Pick<GeoMethod, "language" | "region">;
  disabled: boolean;
  locale: Locale;
  onError: (error: string) => string;
  t: GeoText;
  cancel: string;
  close: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const where = { language: method.language, region: method.region ?? t.methodNoRegion };

  function regenerate(replaceAll: boolean) {
    start(async () => {
      try {
        const result = await regenerateGeoPrompts(websiteId, replaceAll);
        if (!result.ok) {
          toast.error(onError(result.error));
          return;
        }
        toast.success(format(t.regenerated, { count: formatNumber(result.data.added, locale), action: t.checkNow }));
        setOpen(false);
        router.refresh();
      } catch {
        toast.error(t.errUnexpected);
      }
    });
  }

  const button = (
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled || pending}>
      {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
      {t.regenerate}
    </Button>
  );

  return (
    <>
      {rewrite > 0 ? (
        <Notice tone="warning" title={t.rewriteTitle} action={button}>
          {format(t.rewriteNotice, { count: formatNumber(rewrite, locale), ...where })}
        </Notice>
      ) : (
        <div className="flex justify-end">{button}</div>
      )}

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent closeLabel={close} className="motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none">
          <DialogHeader>
            <DialogTitle>{t.regenerateTitle}</DialogTitle>
            <DialogDescription>{format(t.regenerateBody, where)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {cancel}
            </Button>
            <Button variant="outline" onClick={() => regenerate(true)} disabled={pending}>
              {t.regenerateAll}
            </Button>
            <Button onClick={() => regenerate(false)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {pending ? t.regenerating : t.regenerateKeep}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
