"use client";

import { Plug } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Locale } from "@/lib/i18n/config";
import { CONNECT_POPUP_COPY } from "@/lib/i18n/connect-popup";
import { format } from "@/lib/i18n/format";

import { connectPopupDismissed, dismissConnectPopup } from "./connect-popup-state";

const noSubscription = () => () => {};

/**
 * Opened with an article when its website has no publishing connection: for
 * automatic posting, connect it (client, 2026-11-24). Once per visit to the
 * article, and not again for this website for a while after "Not now"
 * (connect-popup-state.ts). The page decides whether there is anything to
 * connect and whether this person may (connect-popup-state.ts offersConnect).
 *
 * Nothing is rendered on the server: what was dismissed is only known in the
 * browser.
 */
export function ConnectPopup({ websiteId, domain, locale }: { websiteId: string; domain: string; locale: Locale }) {
  const copy = CONNECT_POPUP_COPY[locale];
  const due = useSyncExternalStore(
    noSubscription,
    () => !connectPopupDismissed(websiteId),
    () => false,
  );
  const [closed, setClosed] = useState(false);

  const close = () => {
    setClosed(true);
    dismissConnectPopup(websiteId);
  };

  return (
    <Dialog open={due && !closed} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent
        closeLabel={copy.later}
        className="gap-5 p-6 sm:max-w-md motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
        data-testid="connect-popup"
      >
        <DialogHeader>
          <span aria-hidden className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plug className="size-5" />
          </span>
          <DialogTitle className="pr-6 text-lg text-balance">{copy.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 leading-relaxed">
              <p className="wrap-anywhere">{format(copy.body, { domain })}</p>
              <p>{copy.how}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {copy.later}
          </Button>
          <Button asChild>
            <Link href={`/websites/${websiteId}/integrations`} onClick={close}>
              {copy.connect}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
