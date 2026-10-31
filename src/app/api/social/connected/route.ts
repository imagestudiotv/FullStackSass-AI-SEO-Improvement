import { NextResponse } from "next/server";

import { queueJob } from "@/inngest/send";
import { getSession } from "@/lib/auth-guard";
import { listAccounts, syncBundleAccounts } from "@/lib/social/accounts";
import { isBundleConfigured } from "@/lib/social/bundle";
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
 * The video platforms (Instagram, TikTok, YouTube, Facebook: lib/video) come
 * back here too, and go on to the Videos page.
 */

export const dynamic = "force-dynamic";

function back(path: string, params: Record<string, string>) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return NextResponse.redirect(`${base}${path}?${new URLSearchParams(params).toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const websiteId = url.searchParams.get("website") ?? "";
  const platform = url.searchParams.get("platform") ?? "";

  if (!(await getSession())) return back("/sign-in", {});
  const video = isVideoPlatform(platform);
  if (!/^[0-9a-f-]{36}$/i.test(websiteId) || (!isSocialPlatform(platform) && !video)) return back("/websites", {});

  const editor = await requireEditor(websiteId).catch(() => null);
  if (!editor?.ok) return back("/websites", {});
  const page = `/websites/${websiteId}/${video ? "videos" : "social"}`;
  if (!isBundleConfigured()) return back(page, { social: "not_configured" });

  try {
    const before = new Set((await listAccounts(websiteId)).filter((row) => row.bundleAccountId).map((row) => row.platform));
    const after = await syncBundleAccounts(websiteId);
    const connected = after.some((row) => row.platform === platform && row.bundleAccountId);
    if (connected && !before.has(platform) && !video) {
      await queueJob({ name: "social/suggest.requested", data: { websiteId } });
    }
    return back(page, { social: connected ? "connected" : "not_connected", platform });
  } catch (error) {
    console.error("[social] reading connected accounts failed", { websiteId, platform, error });
    return back(page, { social: "connect_failed", platform });
  }
}
