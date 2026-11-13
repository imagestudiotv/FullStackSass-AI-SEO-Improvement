"use client";

import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Switch } from "@/components/ui/switch";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { SocialConnectionsCopy } from "@/lib/i18n/social-connections";
import { setPinterestBoard, setSocialAutoPost, type SocialResult } from "@/lib/social/actions";
import { PLATFORMS, profileUrl, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/platforms";

import type { AccountView } from "./opportunities";
import { PlatformTile, type T } from "./social-shared";

type Run = (action: () => Promise<SocialResult<unknown>>, options?: { success?: string }) => void;

/**
 * The connected accounts' own settings, behind the "Social connections"
 * panel's "Account settings" (connections-panel.tsx; client, 2026-11-11):
 * the profile, the warm-up, automatic posting, a pause and the Pinterest
 * board. Connecting and disconnecting are the panel's cards now; until then
 * this dialog (the channels strip's "Manage", 2026-11-03) did both.
 */
export function AccountsDialog({
  open,
  onOpenChange,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  accounts: AccountView[];
  platforms: string[];
  manualOnly?: boolean;
  boards: string[];
  canEdit: boolean;
  pending: boolean;
  run: Run;
  priceLabel: string;
  locale: Locale;
  t: T;
  copy: SocialConnectionsCopy;
}) {
  const { t, copy } = props;
  // A platform the plan does not include is not connected (the panel counts the same way).
  const connected = SOCIAL_PLATFORMS.flatMap((platform) => {
    const account = props.platforms.includes(platform) ? props.accounts.find((row) => row.platform === platform) : undefined;
    return account ? [{ platform, account }] : [];
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-lg" closeLabel={t.close}>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">{copy.settings}</DialogTitle>
          <DialogDescription>{copy.settingsIntro}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {connected.map(({ platform, account }) => (
            <AccountRow key={platform} platform={platform} account={account} {...props} />
          ))}
        </ul>
        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{format(t.price, { price: props.priceLabel })}</p>
          <DialogClose asChild>
            <Button>{t.done}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountRow({
  platform,
  account,
  manualOnly,
  boards,
  canEdit,
  pending,
  run,
  websiteId,
  locale,
  t,
}: {
  platform: SocialPlatform;
  account: AccountView;
  manualOnly?: boolean;
  boards: string[];
  canEdit: boolean;
  pending: boolean;
  run: Run;
  websiteId: string;
  locale: Locale;
  t: T;
}) {
  const id = useId();
  const spec = PLATFORMS[platform];
  const [board, setBoard] = useState(account.target ?? boards[0] ?? "");
  const warmup = account.inWarmup;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <PlatformTile platform={platform} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{spec.name}</h3>
          <a
            href={profileUrl(platform, account.username)}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {format(t.connectedAs, { name: account.username })}
          </a>
        </div>
        {warmup ? <Badge variant="secondary">{t.warmupBadge}</Badge> : null}
      </div>

      <div className="mt-3 space-y-2 text-sm sm:pl-11">
        {warmup ? (
          <p className="text-xs text-muted-foreground">
            {format(t.warmup, { date: formatDate(account.warmupEndsAt, locale, { day: "numeric", month: "long" }) })}
          </p>
        ) : null}
        {account.connected && spec.ownPosts && !manualOnly ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id={`${id}-auto`} className="font-medium">
                {t.autoPost}
              </p>
              <p className="text-xs text-muted-foreground">{t.autoPostHelp}</p>
            </div>
            <Switch
              aria-labelledby={`${id}-auto`}
              checked={account.autoPost && account.pausedReason === null}
              disabled={!canEdit || pending}
              onCheckedChange={(on) => run(() => setSocialAutoPost(websiteId, platform, on))}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.oneClick}</p>
        )}
        {account.pausedReason !== null ? (
          <Notice
            tone="warning"
            action={
              canEdit ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setSocialAutoPost(websiteId, platform, true))}>
                  {t.resume}
                </Button>
              ) : null
            }
          >
            {format(t.paused, { platform: spec.name, reason: account.pausedReason || "-" })}
          </Notice>
        ) : null}
        {platform === "pinterest" && account.connected ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium">
              {t.boardLabel}
              {boards.length > 0 ? (
                <NativeLikeSelect value={board} onChange={(event) => setBoard(event.target.value)} disabled={!canEdit}>
                  {boards.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeLikeSelect>
              ) : (
                <Input value={board} onChange={(event) => setBoard(event.target.value)} className="h-8" disabled={!canEdit} />
              )}
            </label>
            {canEdit && board !== (account.target ?? "") ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setPinterestBoard(websiteId, board), { success: t.saved })}>
                {t.boardSave}
              </Button>
            ) : null}
          </div>
        ) : null}
        {platform === "quora" ? <p className="text-xs text-muted-foreground">{t.quoraNote}</p> : null}
        {platform === "pinterest" ? <p className="text-xs text-muted-foreground">{t.pinterestNote}</p> : null}
      </div>
    </li>
  );
}
