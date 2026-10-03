import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SHARE_IMAGE } from "@/lib/share-image";

/**
 * The picture shown when a RepGet link is shared - LinkedIn, WhatsApp, Slack,
 * Facebook, X (which reads og:image when no twitter:image is set).
 *
 * There was none, so every shared link appeared as bare text (client's launch
 * review, 2026-10-03). Placed at the root of app/, so Next applies it to every
 * page; a page that sets its own openGraph.images still wins.
 *
 * Drawn in code rather than designed, at the owner's choice: it can be swapped
 * for a designed 1200x630 opengraph-image.png in this folder at any time,
 * deleting this file.
 *
 * Built once at build time (no request data is read), so it costs nothing per
 * share. Wording is the homepage's title and description; colours are the
 * site's own (globals.css --primary and --foreground, converted from oklch,
 * which the image renderer does not read). The font is Geist, which next/og
 * bundles and the site itself uses.
 */

// From lib/share-image.ts, which the pages that name this picture also read.
export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = "image/png";

const ORANGE = "#eb5702";
const INK = "#0a0a0a";
const MUTED = "#525252";

// The wordmark, 2757x690. Read once at module scope, as the docs advise.
const logo = await readFile(join(process.cwd(), "public/images/repget-logo.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
const LOGO_HEIGHT = 64;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 2757) / 690);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          borderTop: `14px solid ${ORANGE}`,
          padding: "64px 80px 60px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image */}
        <img src={logoSrc} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1040 }}>
          {/*
            Two set lines rather than one wrapped string. Left to wrap, the
            renderer broke it as "...Content &" / "Backlinks" with a stray wide
            gap mid-line; negative letter-spacing made that worse, so there is
            none.
          */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              lineHeight: 1.12,
              color: INK,
            }}
          >
            <span>AI SEO Platform</span>
            <span>for Content &amp; Backlinks</span>
          </div>
          <div style={{ marginTop: 30, fontSize: 30, lineHeight: 1.45, color: MUTED }}>
            {"Research keywords, publish optimized content, build quality backlinks and track rankings in Google and AI search."}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: ORANGE }}>
          www.repget.com
        </div>
      </div>
    ),
    { ...size },
  );
}
