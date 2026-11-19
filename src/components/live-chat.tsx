"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { splitLocale } from "@/lib/i18n/config";
import { recordSupportChatEventAction } from "@/lib/support/actions";

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
 *
 * Two things about this widget cannot be changed from code, both verified
 * against Crisp's own SDK reference rather than assumed:
 *
 *  - THE BUBBLE ICON. The SDK exposes `user:avatar`, which is the visitor's
 *    own picture, and nothing for the launcher or the website avatar. Those
 *    are uploaded in the dashboard: Settings > Website Settings > Chatbox
 *    Appearance. Upload public/icon-512.png so the bubble matches the
 *    favicon. Do not add code here that appears to do it.
 *
 *  - FULL VIEW ON MOBILE. disable_full_view below keeps the chatbox windowed
 *    on a phone instead of taking over the screen. It must be set BEFORE the
 *    script loads — Crisp reads CRISP_RUNTIME_CONFIG once at startup and
 *    ignores later changes — which is why the initializer sets it before
 *    loading the SDK, rather than pushing it through the command queue.
 *
 * That flag has a side effect Crisp does not document: their stylesheet
 * carries one rule keyed on it,
 *
 *   .cc-165wh[data-disable-full-view=true] .cc-lk42u .cc-13wro[data-maximized=true]
 *     { display: none !important }
 *
 * which HIDES THE LAUNCHER whenever the chatbox is open. Setting the flag
 * alone therefore fixes the full-screen takeover and removes the only obvious
 * way to close the chat — the exact pair of complaints this is meant to
 * answer. crisp-close.css overrides that one rule, so the button stays put
 * and keeps the close icon. Neither half works without the other; read that
 * file before changing either.
 */
/**
 * Crisp website ids are UUIDs. Ignore malformed deployment configuration
 * instead of loading a widget that cannot connect to its account.
 */
const WEBSITE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CrispCommand = [string, string?, unknown?];

/**
 * The queue Crisp drains once its script loads, so calls made before then are
 * kept rather than lost. Once loaded it is Crisp's own object, which also
 * answers `is` and `get` (docs.crisp.chat, Web SDK "$crisp"); those two are
 * synchronous and exist only after the load, hence optional.
 */
export type CrispQueue = {
  push: (command: CrispCommand) => unknown;
  is?: (key: string) => boolean;
  get?: (key: string) => unknown;
};

declare global {
  interface Window {
    $crisp?: CrispQueue;
    CRISP_WEBSITE_ID?: string;
    /** Read once at startup; later changes are ignored. */
    CRISP_RUNTIME_CONFIG?: { disable_full_view?: boolean };
  }
}

/**
 * Sends one command to Crisp without letting it break the page.
 *
 * Crisp does not ignore a command it does not recognise — it THROWS. A single
 * mistyped namespace ("set"/"session:locale" instead of "config"/"locale")
 * therefore escaped a useEffect, unmounted the React tree, and left every
 * signed-in customer looking at the global error screen instead of their
 * dashboard. The chat widget is a convenience; it must never be able to take
 * the product down with it.
 *
 * Once the real script has loaded, $crisp is Crisp's own object and push()
 * validates. Before that it is a plain array and anything queues silently,
 * which is why this only ever fails after load — and why it went unnoticed
 * locally where the widget is usually unconfigured.
 */
export function pushToCrisp(command: CrispCommand): void {
  try {
    (window.$crisp ??= []).push(command);
  } catch (error) {
    // Logged, never rethrown. A rejected chat setting is not worth a blank page.
    console.error("[live-chat] Crisp rejected", command[1] ?? command[0], error);
  }
}

export type ChatUser = {
  email: string;
  name: string | null;
  /** Workspace name, so a message says which account it is about. */
  organization: string | null;
  /** Plan name, so support knows what the person is paying for. */
  plan: string | null;
  /**
   * Crisp identity verification: HMAC-SHA256 of the email with
   * CRISP_IDENTITY_SECRET, hex (lib/support/crisp-identity.ts). Null when the
   * secret is not set, and then the email is sent unsigned as before.
   */
  emailSignature?: string | null;
  /**
   * More for the operator, as Crisp session data (ticket 2026-11-19: "account
   * or workspace identifier, trial or subscription status, onboarding
   * completion status, preferred interface language"). Strings, numbers and
   * booleans only - what Crisp accepts.
   */
  data?: Record<string, string | number | boolean>;
};

/**
 * Loads Crisp's script now, if it is not already there. LiveChat waits for
 * the first interaction before doing this; the onboarding welcome
 * (crisp-onboarding.tsx) calls it when the welcome is due and nobody has
 * touched the page.
 */
export function loadCrispScript(): void {
  if (typeof document === "undefined" || document.getElementById("crisp-sdk")) return;
  const script = document.createElement("script");
  script.id = "crisp-sdk";
  script.src = "https://client.crisp.chat/l.js";
  script.async = true;
  document.head.appendChild(script);
}

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

    // Signed when the deployment has the secret (identity verification, Crisp Mini and up): the conversation then shows as verified.
    pushToCrisp(["set", "user:email", user.emailSignature ? [user.email, user.emailSignature] : [user.email]]);
    if (user.name) pushToCrisp(["set", "user:nickname", [user.name]]);
    if (user.organization) {
      pushToCrisp(["set", "user:company", [user.organization]]);
    }

    /**
     * Plan lives in session data rather than on the company, because it
     * changes on upgrade and a stale plan in a support conversation produces
     * the wrong answer about limits.
     */
    const data: [string, string | number | boolean][] = [];
    if (user.plan) data.push(["plan", user.plan]);
    if (user.organization) data.push(["workspace", user.organization]);
    for (const [key, value] of Object.entries(user.data ?? {})) data.push([key, value]);
    if (data.length > 0) pushToCrisp(["set", "session:data", [data]]);
  }, [enabled, user]);

  /**
   * Inside the product: no sounds, and what happens in the chat is noted for
   * the onboarding welcome and the support numbers (lib/support).
   *
   * Muted per the onboarding spec ("Do not play notification sounds"); Crisp
   * has no dashboard switch for the visitor's sounds, only this command.
   *
   * The events say only THAT something happened - never a message's text.
   * Each kind is sent at most once per page view (a sent message at most once
   * a minute), so a long conversation is not a stream of requests; the
   * server keeps the first time of each and counts requests itself.
   */
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!enabled || !signedIn) return;
    pushToCrisp(["config", "sound:mute", [true]]);
    const lastSent = new Map<string, number>();
    const note = (event: "opened" | "closed" | "sent" | "received", every = Infinity) => () => {
      const last = lastSent.get(event);
      if (last !== undefined && (every === Infinity || Date.now() - last < every)) return;
      lastSent.set(event, Date.now());
      void recordSupportChatEventAction(event).catch(() => {});
    };
    pushToCrisp(["on", "chat:opened", note("opened")]);
    pushToCrisp(["on", "chat:closed", note("closed")]);
    pushToCrisp(["on", "message:sent", note("sent", 60_000)]);
    pushToCrisp(["on", "message:received", note("received")]);
    return () => {
      for (const name of ["chat:opened", "chat:closed", "message:sent", "message:received"]) pushToCrisp(["off", name]);
    };
  }, [enabled, signedIn]);

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
    // ["config", "locale", ...] — NOT ["set", "session:locale", ...]. That
    // namespace does not exist, and see pushToCrisp for what it cost.
    pushToCrisp(["config", "locale", [pathLocale]]);
  }, [enabled, pathLocale]);

  /**
   * Warm the widget to match the brand.
   *
   * Crisp defaults to its own blue, which was the last blue left anywhere in
   * the product once the status badges moved to the brand orange. "deep_orange"
   * is the nearest value Crisp offers — the palette is a fixed list, not a hex
   * field, so this is as close as the widget can be steered from code.
   */
  useEffect(() => {
    if (!enabled) return;
    pushToCrisp(["config", "color:theme", ["deep_orange"]]);
    /**
     * No tooltip beside the launcher. It covers the bubble with a speech
     * balloon on load, which hides the brand mark the bubble is there to
     * show, and it says nothing the bubble does not.
     */
    pushToCrisp(["config", "availability:tooltip", [false]]);
  }, [enabled]);


  // Initialize from the trusted application bundle, not an inline script.
  // This works under nonce CSP on both full loads and client navigation.
  useEffect(() => {
    if (!enabled || !websiteId) return;
    window.$crisp ??= [];
    window.CRISP_WEBSITE_ID = websiteId;
    window.CRISP_RUNTIME_CONFIG = { disable_full_view: true };
    const events = ["scroll", "wheel", "keydown", "touchstart", "pointerdown", "mousemove"];
    const cleanup = () => events.forEach((event) => window.removeEventListener(event, load, true));
    function load() {
      cleanup();
      loadCrispScript();
    }
    if (!document.getElementById("crisp-sdk")) {
      events.forEach((event) => window.addEventListener(event, load, { capture: true, passive: true }));
    }
    return cleanup;
  }, [enabled, websiteId]);

  return null;
}
