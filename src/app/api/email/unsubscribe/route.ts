import { NextResponse, type NextRequest } from "next/server";

import { setTips } from "@/lib/email/lifecycle";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

/**
 * POST /api/email/unsubscribe?token=...
 *
 * Turns one person's tips and reports off (or back on), from a signed link,
 * without signing in (lib/email/unsubscribe-token.ts). Two callers:
 *
 *  - A MAIL CLIENT, one-click (RFC 8058): Gmail's and Yahoo's "Unsubscribe"
 *    next to the sender posts "List-Unsubscribe=One-Click" to the address in
 *    the List-Unsubscribe header. It wants a 2xx and nothing else.
 *  - THE UNSUBSCRIBE PAGE's form (/unsubscribe/<token>), which is sent back
 *    to that page to show the result.
 *
 * POST ONLY, never on GET: mail scanners and link previews fetch every link
 * in a message, and a GET that unsubscribed would switch people off who
 * never pressed anything. The page itself only shows a button.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = url.searchParams.get("token") ?? (form?.get("token") as string | null) ?? null;
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "This link is not valid." }, { status: 400 });
  }

  const oneClick = form?.get("List-Unsubscribe") === "One-Click";
  const resubscribe = !oneClick && form?.get("action") === "resubscribe";
  try {
    await setTips(userId, resubscribe, "link");
  } catch (error) {
    console.error("[unsubscribe] could not save the preference", error);
    return NextResponse.json({ ok: false, error: "Please try again." }, { status: 500 });
  }

  if (oneClick) return NextResponse.json({ ok: true });
  // 303: the browser follows with a GET, so a refresh does not post the form again.
  return NextResponse.redirect(
    new URL(`/unsubscribe/${encodeURIComponent(token!)}?done=${resubscribe ? "on" : "off"}`, url.origin),
    303,
  );
}
