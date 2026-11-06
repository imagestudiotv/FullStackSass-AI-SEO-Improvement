"use client";

import { Lock } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Switch } from "@/components/ui/switch";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import {
  connectSocialUsername,
  disconnectSocial,
  setPinterestBoard,
  setSocialAutoPost,
  startSocialConnect,
  type SocialResult,
} from "@/lib/social/actions";
import { PLATFORMS, profileUrl, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/platforms";

import type { AccountView } from "./opportunities";
import { PlatformTile, type T } from "./social-shared";

type Run = (action: () => Promise<SocialResult<unknown>>, options?: { success?: string }) => void;

/**
 * The accounts behind the channels strip's "Manage" (client's design,
 * 2026-11-03): the six platforms' connect, disconnect, automatic posting and
 * Pinterest board, as the page had them before, in one dialog. A trial's
 * locked platforms are listed but cannot be connected.
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
  bundle: boolean;
  boards: string[];
  canEdit: boolean;
  pending: boolean;
  run: Run;
  priceLabel: string;
  locale: Locale;
  t: T;
}) {
  const { t } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-lg" closeLabel={t.close}>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">{t.accountsTitle}</DialogTitle>
          <DialogDescription>{t.accountsIntro}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {SOCIAL_PLATFORMS.map((platform) => (
            <AccountRow
              key={platform}
              platform={platform}
              account={props.accounts.find((account) => account.platform === platform) ?? null}
              locked={!props.platforms.includes(platform)}
              {...props}
            />
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
  locked,
  manualOnly,
  bundle,
  boards,
  canEdit,
  pending,
  run,
  websiteId,
  locale,
  t,
}: {
  platform: SocialPlatform;
  account: AccountView | null;
  locked: boolean;
  manualOnly?: boolean;
  bundle: boolean;
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
  const [username, setUsername] = useState("");
  const [board, setBoard] = useState(account?.target ?? boards[0] ?? "");
  const [opening, setOpening] = useState(false);
  // Through bundle.social when it is set up; Quora (and everything without it) by username.
  const viaBundle = Boolean(spec.bundleType) && bundle;
  const warmup = account?.inWarmup ?? false;

  async function connect() {
    setOpening(true);
    const result = await startSocialConnect(websiteId, platform, locale).catch(() => null);
    if (result?.ok) {
      window.location.href = result.data.url;
      return;
    }
    setOpening(false);
    toast.error(result && !result.ok ? (t.errors[result.error] ?? t.errors.generic) : t.errors.generic);
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <PlatformTile platform={platform} muted={locked || !account} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{spec.name}</h3>
          {locked ? (
            <p className="text-xs text-muted-foreground">{t.lockedTrial}</p>
          ) : account ? (
            <a
              href={profileUrl(platform, account.username)}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {format(t.connectedAs, { name: account.username })}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground first-letter:uppercase">{t.channelState.off}</p>
          )}
        </div>
        {locked ? (
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : warmup ? (
          <Badge variant="secondary">{t.warmupBadge}</Badge>
        ) : null}
      </div>

      {locked || (!account && !canEdit) ? null : (
        <div className="mt-3 space-y-2 text-sm sm:pl-11">
          {account ? (
            <>
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
              {canEdit ? (
                <Button size="sm" variant="ghost" className="-ml-2.5" disabled={pending} onClick={() => run(() => disconnectSocial(websiteId, platform))}>
                  {t.disconnect}
                </Button>
              ) : null}
            </>
          ) : viaBundle ? (
            <>
              <Button size="sm" onClick={connect} disabled={opening || pending}>
                {opening ? t.connecting : t.connect}
              </Button>
              {platform === "bluesky" ? <p className="text-xs text-muted-foreground">{t.blueskyNote}</p> : null}
            </>
          ) : (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => connectSocialUsername(websiteId, platform, username));
              }}
            >
              <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium">
                {format(t.usernameLabel, { platform: spec.name })}
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.usernamePlaceholder} className="h-8" />
              </label>
              <Button size="sm" type="submit" disabled={pending || !username.trim()}>
                {t.save}
              </Button>
              {platform === "quora" ? <p className="w-full text-xs text-muted-foreground">{t.quoraNote}</p> : null}
            </form>
          )}
        </div>
      )}
    </li>
  );
}
