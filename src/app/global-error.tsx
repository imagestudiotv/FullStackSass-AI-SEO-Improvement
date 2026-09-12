"use client";

import { useEffect } from "react";

/**
 * Last-resort error screen.
 *
 * error.tsx cannot catch a throw from a layout in its own segment, so an
 * unguarded failure in (app)/layout.tsx escalated all the way past it to
 * Next's built-in fallback: an unstyled browser page reading "This page
 * couldn't load", outside the app, with no way back and nothing to tell
 * support. That is what a customer saw immediately after signing in when
 * requireOrg threw.
 *
 * The specific cause is fixed in that layout. This exists so the NEXT one
 * looks like the product rather than a crash, because a layout throw will
 * always bypass the per-segment boundary.
 *
 * global-error replaces the root layout when it renders, so it has to supply
 * its own <html> and <body> — no fonts, no theme provider, no shared styles
 * are available here. Everything below is inline for that reason, and the
 * palette is the brand's rather than borrowed from tokens that are not
 * loaded.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry captures this through its Next integration; this is the copy a
    // developer sees in the browser console.
    console.error("[global] unrecoverable render error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#ffffff",
          color: "#171717",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              margin: "0 auto 16px",
              borderRadius: 12,
              background: "#fd9202",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            !
          </div>

          <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>
            Something went wrong
          </h1>

          {/*
            Never error.message. It is written for a log and routinely quotes a
            provider's response or an internal id. The digest is what makes a
            support conversation solvable without disclosing any of that.
          */}
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#525252",
              margin: "0 0 20px",
            }}
          >
            We could not load the page. Reloading usually works.
            {error.digest ? (
              <>
                {" "}
                If it keeps happening, quote reference{" "}
                <code style={{ fontSize: "0.8125rem" }}>{error.digest}</code> to
                support.
              </>
            ) : (
              " If it keeps happening, please contact support."
            )}
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#171717",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/*
              A plain link, not next/link: the router is part of what has just
              failed, and a full document load is what actually recovers. The
              lint rule assumes a working router, which is the one thing this
              screen cannot assume.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                color: "#171717",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
