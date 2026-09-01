"use client";

import Script from "next/script";

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

export function LiveChat() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
  if (!websiteId || !WEBSITE_ID_RE.test(websiteId)) return null;

  return (
    <Script
      id="crisp-chat"
      // afterInteractive, not beforeInteractive: chat is never why someone
      // came to the page, and loading it earlier would delay the content they
      // actually want on a slow connection.
      strategy="afterInteractive"
    >
      {`window.$crisp=[];window.CRISP_WEBSITE_ID="${websiteId}";(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`}
    </Script>
  );
}
