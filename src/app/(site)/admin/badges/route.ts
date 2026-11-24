import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminBadges } from "@/lib/admin/badges";
import { readSeen, SEEN_COOKIE, SEEN_COOKIE_OPTIONS, writeSeen } from "@/lib/admin/badges-seen";
import { seenPathOf } from "@/lib/admin/badges-shared";
import { NotAdminError, requireAdmin } from "@/lib/admin/guard";

/**
 * GET  /admin/badges         the sidebar's counts for this administrator.
 * POST /admin/badges {path}  the same, having opened that page: its "new"
 *                            count starts again from now.
 *
 * A route rather than a server action on purpose: an action that sets a
 * cookie renders the whole page again, on every navigation. To anyone who is
 * not an administrator it does not exist, like the rest of /admin.
 */

export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "private, no-store" };
const notFound = () => new NextResponse("Not found", { status: 404, headers: HEADERS });

async function answer(request: NextRequest, openedPath: string | null) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof NotAdminError) return notFound();
    throw error;
  }
  const store = await cookies();
  const seen = readSeen(store.get(SEEN_COOKIE)?.value, admin.userId);
  const opened = openedPath ? seenPathOf(openedPath) : null;
  if (opened) seen[opened] = new Date();
  const badges = await getAdminBadges(seen, { fresh: request.nextUrl.searchParams.get("fresh") === "1" });
  const response = NextResponse.json(badges, { headers: HEADERS });
  if (opened) response.cookies.set(SEEN_COOKIE, writeSeen(seen, admin.userId, opened, seen[opened]), SEEN_COOKIE_OPTIONS);
  return response;
}

export async function GET(request: NextRequest) {
  return answer(request, null);
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const path = typeof body === "object" && body !== null ? (body as { path?: unknown }).path : null;
  return answer(request, typeof path === "string" ? path.slice(0, 200) : null);
}
