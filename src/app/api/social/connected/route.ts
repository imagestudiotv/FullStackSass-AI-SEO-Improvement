import { NextResponse } from "next/server";

import { queueJob } from "@/inngest/send";
import { getSession } from "@/lib/auth-guard";
import { listAccounts, syncBundleAccounts } from "@/lib/social/accounts";
import { isBundleConfigured } from "@/lib/social/bundle";
import { connectReturnPath } from "@/lib/social/connect-return";
import { isSocialPlatform } from "@/lib/social/platforms";
import { isVideoPlatform } from "@/lib/video/formats";
import { requireEditor } from "@/lib/websites/require-editor";

/**
 * Where bundle.social sends the customer back after connecting an account
 * (lib/social/actions.ts startSocialConnect).
 *
 * Nothing in the query is trusted: the website is checked against the
 * signed-in editor, and the accounts are read from bundle.social for that
 * website's own team - a forged link can at most make RepGet re-read what is
 * already there. A new account gets its first suggestions straight away.
 *
 * The video platforms (Instagram, TikTok, YouTube, Facebook, Pinterest,
 * LinkedIn, X: lib/video) come back here too, and go on to the Videos page.
 * Pinterest and X are both - one account, one social_accounts row - so they
 * go back to the page they were connected from (`from=videos`). The sync
 * stores LinkedIn's chosen profile or page and Instagram's login method
 * (social_accounts.target, lib/social/accounts.ts).
 *
 * The Opportunities page is returned to at its "Social connections" panel
 * (lib/social/connect-return.ts; client, 2026-11-11), which toasts the
 * result: the next account is one click away.
 */

export const dynamic = "force-dynamic";

function redirectTo(pathAndQuery: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return NextResponse.redirect(`${base}${pathAndQuery}`);
}

function back(path: string, params: Record<string, string>) {
  return redirectTo(`${path}?${new URLSearchParams(params).toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const websiteId = url.searchParams.get("website") ?? "";
  const platform = url.searchParams.get("platform") ?? "";

  if (!(await getSession())) return back("/sign-in", {});
  const social = isSocialPlatform(platform);
  if (!/^[0-9a-f-]{36}$/i.test(websiteId) || (!social && !isVideoPlatform(platform))) return back("/websites", {});
  const video = isVideoPlatform(platform) && (!social || url.searchParams.get("from") === "videos");

  const editor = await requireEditor(websiteId).catch(() => null);
  if (!editor?.ok) return back("/websites", {});
  const toPage = (params: Record<string, string>) => redirectTo(connectReturnPath(websiteId, video ? "videos" : "social", params));
  if (!isBundleConfigured()) return toPage({ social: "not_configured" });

  try {
    const before = new Set((await listAccounts(websiteId)).filter((row) => row.bundleAccountId).map((row) => row.platform));
    const after = await syncBundleAccounts(websiteId);
    const connected = after.some((row) => row.platform === platform && row.bundleAccountId);
    // A social platform's first suggestions, wherever it was connected from (Pinterest: either page).
    if (connected && !before.has(platform) && social) {
      await queueJob({ name: "social/suggest.requested", data: { websiteId } });
    }
    return toPage({ social: connected ? "connected" : "not_connected", platform });
  } catch (error) {
    console.error("[social] reading connected accounts failed", { websiteId, platform, error });
    return toPage({ social: "connect_failed", platform });
  }
}
