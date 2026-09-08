"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { splitLocale } from "@/lib/i18n/config";

/**
 * Live chat.
 *
 * The brief asks for chat "exactly working as on babylovegrowth.ai", which is
 * a hosted widget rather than something to build: a real one needs an operator
 * inbox, mobile notifications, canned replies and an agent app, and rebuilding
 * that badly would be worse than not having it.
 *
 * Crisp is the provider, chosen because its free tier covers one operator —
 * which is what a founder answering their own chat actually needs — and the
 * whole integration is one script tag with no server component.
 *
 * Renders nothing when unconfigured, so the site works normally before the
 * account exists and no placeholder widget appears in the corner.
 */
/**
 * Crisp website ids are UUIDs. Validated because the value is interpolated
 * into an inline script: an id is set by whoever configures the deployment
 * rather than by a user, but a malformed one would break the page silently and
 * a crafted one would be script injection. A regex costs nothing and removes
 * the question entirely.
 */
const WEBSITE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The queue Crisp drains once its script loads, so calls made before then are
 * kept rather than lost. Declared here because we use four of its commands.
 */
declare global {
  interface Window {
    $crisp?: [string, string?, unknown?][];
    CRISP_WEBSITE_ID?: string;
  }
}

export type ChatUser = {
  email: string;
  name: string | null;
  /** Workspace name, so a message says which account it is about. */
  organization: string | null;
  /** Plan name, so support knows what the person is paying for. */
  plan: string | null;
};

export function LiveChat({
  user,
  locale,
}: {
  /** Omitted for visitors, who chat anonymously. */
  user?: ChatUser | null;
  /** Marketing pages exist in five languages; the widget follows. */
  locale?: string;
} = {}) {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
  const enabled = Boolean(websiteId && WEBSITE_ID_RE.test(websiteId));

  /**
   * Tell Crisp who this is.
   *
   * In an effect because the command queue only exists on the client, and
   * because these values change when someone signs in or switches workspace
   * without a full page load.
   *
   * Without it every conversation opens by asking who is writing and which
   * workspace they mean, which is most of the reason to put chat inside the
   * product rather than give out an email address.
   */
  useEffect(() => {
    if (!enabled || !user) return;

    const queue = (window.$crisp ??= []);
    queue.push(["set", "user:email", [user.email]]);
    if (user.name) queue.push(["set", "user:nickname", [user.name]]);
    if (user.organization) {
      queue.push(["set", "user:company", [user.organization]]);
    }

    /**
     * Plan lives in session data rather than on the company, because it
     * changes on upgrade and a stale plan in a support conversation produces
     * the wrong answer about limits.
     */
    const data: [string, string][] = [];
    if (user.plan) data.push(["plan", user.plan]);
    if (user.organization) data.push(["workspace", user.organization]);
    if (data.length > 0) queue.push(["set", "session:data", [data]]);
  }, [enabled, user]);

  /**
   * Match the widget's language to the page.
   *
   * Taken from the pathname rather than a prop, because the marketing layout
   * that mounts this sits ABOVE the [locale] segment — it renders the same
   * element for /pricing and /es/pricing, so it has no locale to pass. The URL
   * is the one place both cases agree.
   */
  const pathname = usePathname();
  const pathLocale = locale ?? splitLocale(pathname).locale;

  useEffect(() => {
    if (!enabled || !pathLocale) return;
    (window.$crisp ??= []).push(["set", "session:locale", [pathLocale]]);
  }, [enabled, pathLocale]);

  if (!enabled) return null;

  return (
    <Script
      id="crisp-chat"
      // afterInteractive, not beforeInteractive: chat is never why someone
      // came to the page, and loading it earlier would delay the content they
      // actually want on a slow connection.
      strategy="afterInteractive"
    >
      {`window.$crisp=window.$crisp||[];window.CRISP_WEBSITE_ID="${websiteId}";(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`}
    </Script>
  );
}
