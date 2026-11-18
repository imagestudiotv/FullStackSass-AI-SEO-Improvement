import { cookies, headers } from "next/headers";

import { conversionId } from "./config";
import { leadEventId, metaRequestUser, type MetaServerEvent, type MetaUser } from "./meta-capi";

/**
 * The visitor of the current request in Meta's terms (meta-capi.ts
 * metaRequestUser), read from its cookies and headers: null outside a
 * request, without consent, or while server events are not configured.
 * Read it during the request; send after it (next/server `after`), because
 * a Server Component cannot read cookies inside `after`.
 */
export async function currentMetaUser(person?: { id: string; email?: string | null } | null): Promise<MetaUser | null> {
  try {
    const [jar, list] = await Promise.all([cookies(), headers()]);
    return metaRequestUser((name) => jar.get(name)?.value, (name) => list.get(name), person);
  } catch {
    return null;
  }
}

/** UTC day, "2026-11-18": a Lead counts once per browser per day. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The server's copy of the free audit's Lead (client's guide, section 2 row
 * 3): the id the browser gave it (lib/meta-pixel.ts trackMetaLead), from the
 * same _fbp and day, so Meta counts one. Without _fbp the browser sent
 * nothing, and the id comes from the address instead.
 */
export async function metaLeadEvent(path: string, now: Date = new Date()): Promise<MetaServerEvent | null> {
  const user = await currentMetaUser();
  if (!user) return null;
  const day = utcDay(now);
  const id = user.fbp ? leadEventId(user.fbp, day) : user.ip ? conversionId("lead", `${user.ip}:${day}`) : null;
  if (!id) return null;
  return { name: "Lead", id, time: now, path, user, custom: { content_name: "free_audit" } };
}
