"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import type { SocialConnectionsCopy } from "@/lib/i18n/social-connections";
import { connectSocialUsername, disconnectSocial, startSocialConnect } from "@/lib/social/actions";
import { CONNECTIONS_ANCHOR, type ConnectNotice } from "@/lib/social/connect-return";
import { PLATFORMS, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

import styles from "./connections-panel.module.css";
import { platformName, type AccountView } from "./opportunities";
import { useSocialAction, type T } from "./social-shared";

/** The card's name: the design writes X as "X (Twitter)"; the dialog and toasts say "X". */
const CARD_NAME: Partial<Record<SocialPlatform, string>> = { x: "X (Twitter)" };

/** The design's marks, as it draws them. Decorative: the name is written beside each. */
const LOGO: Record<SocialPlatform, ReactNode> = {
  reddit: (
    <svg viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="20" r="12" fill="currentColor" />
      <path d="M18 8l2-6 6 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="28" cy="5" r="3" fill="currentColor" />
      <ellipse cx="18" cy="22" rx="9" ry="6.5" fill="#fff" />
      <circle cx="14" cy="20" r="1.7" fill="#ff4500" />
      <circle cx="22" cy="20" r="1.7" fill="#ff4500" />
      <path d="M14 24c2.4 2.1 5.6 2.1 8 0" stroke="#ff4500" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  quora: "Q",
  x: "𝕏",
  threads: "@",
  pinterest: "p",
  bluesky: (
    <svg viewBox="0 0 28 28" fill="currentColor">
      <path d="M14 12.5C11.4 8.7 6.7 4 4.2 4.2.8 4.5 1.4 8.1 1.7 9.4c1.1 4.8 5.2 6.3 9.3 5.6-3.6.8-7.2 2.6-5.4 6 1.6 3 5.1 2 8.1-2.2.3-.4.5-1 .6-1.4.1.4.3 1 .6 1.4 3 4.2 6.5 5.2 8.1 2.2 1.8-3.4-1.8-5.2-5.4-6 4.1.7 8.2-.8 9.3-5.6.3-1.3.9-4.9-2.5-5.2C21.3 4 16.6 8.7 14 12.5Z" />
    </svg>
  ),
};

/**
 * Social connections (client's design, 2026-11-11: "all socials in one line
 * with option to click connect"): the six platforms as cards, each connected
 * or disconnected in one click, with a count and a meter.
 *
 * Connect goes to bundle.social's page and comes back here, at this panel,
 * with a toast (lib/social/connect-return.ts); Quora - and every platform
 * while bundle.social is not set up - asks for the username in a small
 * dialog. A trial's locked platforms show the lock's words and a disabled
 * Connect; a viewer sees the panel without buttons. A connected account's
 * own settings (automatic posting, Pinterest board) open from the footer.
 */
export function ConnectionsPanel({
  websiteId,
  accounts,
  platforms,
  bundle,
  canEdit,
  priceLabel,
  notice,
  onSettings,
  locale,
  t,
  copy,
}: {
  websiteId: string;
  accounts: AccountView[];
  /** What the plan includes (a trial: Quora). */
  platforms: string[];
  /** bundle.social is set up: the platforms with an API connect through it. */
  bundle: boolean;
  canEdit: boolean;
  priceLabel: string;
  /** How the last connection went, from the return's query (api/social/connected). */
  notice: { kind: ConnectNotice; platform: string | null } | null;
  onSettings: () => void;
  locale: Locale;
  t: T;
  copy: SocialConnectionsCopy;
}) {
  const id = useId();
  const { pending, run } = useSocialAction(t, priceLabel);
  const [opening, setOpening] = useState<SocialPlatform | null>(null);
  // The dialogs keep their platform while they close, so their words do not blank out mid-fade.
  const [asking, setAsking] = useState<SocialPlatform>("quora");
  const [askOpen, setAskOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [confirming, setConfirming] = useState<SocialPlatform>("reddit");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const locked = (platform: SocialPlatform) => !platforms.includes(platform);
  // As before: an account on a platform the plan no longer includes does not count.
  const isOn = (platform: SocialPlatform) => !locked(platform) && accounts.some((account) => account.platform === platform);
  const count = SOCIAL_PLATFORMS.filter(isOn).length;
  const total = SOCIAL_PLATFORMS.length;

  // Back from connecting: say how it went, once, and keep the panel in view for the next one.
  const noticeKind = notice?.kind ?? null;
  const noticePlatform = notice?.platform ?? null;
  const connectedToast = copy.toastConnected;
  const notNotice = t.notConnectedNotice;
  const connectFailed = t.errors.connect_failed;
  const notConfigured = t.errors.not_configured;
  useEffect(() => {
    if (!noticeKind) return;
    const platform = platformName(noticePlatform ?? "");
    const options = { id: "social-connect-result" };
    if (noticeKind === "connected") toast.success(format(connectedToast, { platform }), options);
    else if (noticeKind === "not_connected") toast.error(format(notNotice, { platform }), options);
    else toast.error(noticeKind === "not_configured" ? notConfigured : connectFailed, options);
    // A reload must not announce it again; the hash keeps the place.
    window.history.replaceState(null, "", `${window.location.pathname}#${CONNECTIONS_ANCHOR}`);
    document.getElementById(CONNECTIONS_ANCHOR)?.scrollIntoView({ block: "start" });
  }, [noticeKind, noticePlatform, connectedToast, notNotice, connectFailed, notConfigured]);

  // The browser's Back from bundle.social's page can restore this page as it was left: "Opening…".
  useEffect(() => {
    const reset = () => setOpening(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function connect(platform: SocialPlatform) {
    // Quora has no API; without bundle.social nothing has one.
    if (!PLATFORMS[platform].bundleType || !bundle) {
      setUsername("");
      setAsking(platform);
      setAskOpen(true);
      return;
    }
    setOpening(platform);
    const result = await startSocialConnect(websiteId, platform, locale).catch(() => null);
    if (result?.ok) {
      window.location.assign(result.data.url);
      return;
    }
    setOpening(null);
    toast.error(result && !result.ok ? (t.errors[result.error] ?? t.errors.generic) : t.errors.generic);
  }

  const asked = PLATFORMS[asking].name;
  const confirmed = PLATFORMS[confirming].name;

  return (
    <div id={CONNECTIONS_ANCHOR} className={styles.root}>
      <div className={styles.eyebrow}>{copy.eyebrow}</div>
      <section className={styles.panel} aria-labelledby={`${id}-title`}>
        <div className={styles.head}>
          <div>
            <h2 id={`${id}-title`} className={styles.title}>
              {copy.title}
            </h2>
            <p className={styles.sub}>{copy.sub}</p>
          </div>
          <div className={styles.counter} aria-live="polite">
            <strong>{format(copy.counter, { count: String(count), total: String(total) })}</strong>
            <div className={styles.meter} aria-hidden="true">
              <span style={{ width: `${(100 * count) / total}%` }} />
            </div>
          </div>
        </div>

        <ul className={styles.accounts}>
          {SOCIAL_PLATFORMS.map((platform) => {
            const on = isOn(platform);
            const off = locked(platform);
            const nameId = `${id}-${platform}`;
            return (
              <li key={platform} className={cn(styles.account, on ? styles.isConnected : styles.notConnected)}>
                <div className={styles.accountHead}>
                  <span className={cn(styles.logo, styles[platform])} aria-hidden="true">
                    {LOGO[platform]}
                  </span>
                  <div>
                    <h3 id={nameId} className={styles.name}>
                      {CARD_NAME[platform] ?? PLATFORMS[platform].name}
                    </h3>
                    <div className={styles.status}>
                      <span className={styles.dot} aria-hidden="true" />
                      <span>{on ? copy.connected : copy.notConnected}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.foot}>
                  <span id={`${nameId}-note`} className={styles.note}>
                    {off ? t.lockedTrial : on ? copy.linked : copy.ready}
                  </span>
                  {!canEdit ? null : on ? (
                    <button type="button" className={styles.action} aria-describedby={nameId} disabled={pending} onClick={() => {
                        setConfirming(platform);
                        setConfirmOpen(true);
                      }}>
                      {t.disconnect}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cn(styles.action, styles.connect)}
                      aria-describedby={`${nameId} ${nameId}-note`}
                      disabled={off || pending || opening !== null}
                      // bundle.social signs in on Bluesky's own page, which refuses app passwords.
                      title={platform === "bluesky" && bundle && !off ? t.blueskyNote : undefined}
                      onClick={() => connect(platform)}
                    >
                      {opening === platform ? t.connecting : t.connect}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className={styles.footer}>
          <span className={styles.hint}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 10v6M12 7v1" />
            </svg>
            {copy.hint}
          </span>
          {count > 0 ? (
            <button type="button" className={styles.footerButton} onClick={onSettings}>
              <Settings2 aria-hidden="true" />
              {copy.settings}
            </button>
          ) : null}
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className={styles.dialog} overlayClassName={styles.backdrop} showCloseButton={false}>
          <DialogTitle>{format(copy.confirmTitle, { platform: confirmed })}</DialogTitle>
          <DialogDescription className={styles.dialogText}>{copy.confirmBody}</DialogDescription>
          <div className={styles.dialogActions}>
            <button type="button" onClick={() => setConfirmOpen(false)}>
              {copy.cancel}
            </button>
            <button
              type="button"
              className={styles.danger}
              disabled={pending}
              onClick={() =>
                run(() => disconnectSocial(websiteId, confirming), {
                  success: format(copy.toastDisconnected, { platform: confirmed }),
                  then: () => setConfirmOpen(false),
                })
              }
            >
              {copy.confirmAction}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className={styles.dialog} overlayClassName={styles.backdrop} showCloseButton={false}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(() => connectSocialUsername(websiteId, asking, username), {
                success: format(copy.toastConnected, { platform: asked }),
                then: () => setAskOpen(false),
              });
            }}
          >
            <DialogTitle>{format(copy.usernameTitle, { platform: asked })}</DialogTitle>
            {asking === "quora" ? (
              <DialogDescription className={styles.dialogText}>{t.quoraNote}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{format(t.usernameLabel, { platform: asked })}</DialogDescription>
            )}
            <label className={styles.field}>
              {format(t.usernameLabel, { platform: asked })}
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.usernamePlaceholder} autoComplete="off" />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setAskOpen(false)}>
                {copy.cancel}
              </button>
              <button type="submit" className={styles.primary} disabled={pending || !username.trim()}>
                {t.connect}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
