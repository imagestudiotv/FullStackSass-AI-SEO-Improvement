import "server-only";

import { adminEmails } from "@/lib/admin/guard";
import { emailButton, emailLayout, emailNote, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";

/**
 * "Start monitoring crisp.chat daily if there are any help or info requests"
 * (ticket 2026-11-19, item 6): once a day, the conversations updated in the
 * last 24 hours plus every one still unresolved, emailed to ADMIN_EMAILS.
 *
 * Crisp's REST API v1 (docs.crisp.chat/references/rest-api/v1/, "List
 * Conversations"): GET /v1/website/{website_id}/conversations/{page}, Basic
 * auth with the token's identifier and key, and X-Crisp-Tier naming the
 * token's kind. A WEBSITE token (Settings -> Workspace Settings -> Advanced
 * configuration -> API Token, owner only, no approval, 10,000 requests a
 * day) is the default; a Marketplace plugin token works too with
 * CRISP_API_TIER=plugin and the scope website:conversation:sessions.
 *
 * Off - and makes no request at all - unless CRISP_API_IDENTIFIER,
 * CRISP_API_KEY and NEXT_PUBLIC_CRISP_WEBSITE_ID are all set. Nothing is
 * stored: Crisp stays the record. Nothing is sent on a day with nothing to
 * read, so an email always means "someone wrote".
 */

const API = "https://api.crisp.chat/v1";
const PER_PAGE = 50;
/** At most this many pages per list: 250 conversations a day is far beyond today's volume, and a bound on a runaway loop. */
const MAX_PAGES = 5;
const PREVIEW_CHARS = 160;

export type CrispApiConfig = { identifier: string; key: string; tier: "website" | "plugin"; websiteId: string };

export function crispApiConfig(env: Record<string, string | undefined> = process.env): CrispApiConfig | null {
  const identifier = env.CRISP_API_IDENTIFIER?.trim();
  const key = env.CRISP_API_KEY?.trim();
  const websiteId = env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
  if (!identifier || !key || !websiteId) return null;
  return { identifier, key, tier: env.CRISP_API_TIER?.trim() === "plugin" ? "plugin" : "website", websiteId };
}

/** The fields of Crisp's conversation object the digest reads; everything else is ignored. */
type CrispConversation = {
  session_id?: string;
  state?: string;
  created_at?: number;
  updated_at?: number;
  last_message?: string;
  preview_message?: { excerpt?: string; from?: string } | null;
  unread?: { operator?: number } | null;
  meta?: { nickname?: string; email?: string } | null;
};

export type DigestConversation = {
  sessionId: string;
  who: string;
  email: string | null;
  state: string;
  preview: string;
  updatedAt: Date | null;
  unreadByUs: number;
  link: string;
};

export function inboxLink(websiteId: string, sessionId: string): string {
  return `https://app.crisp.chat/website/${encodeURIComponent(websiteId)}/inbox/${encodeURIComponent(sessionId)}/`;
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > PREVIEW_CHARS ? `${clean.slice(0, PREVIEW_CHARS - 1)}…` : clean;
}

export function toDigestConversation(websiteId: string, row: CrispConversation): DigestConversation | null {
  if (!row.session_id) return null;
  const nickname = row.meta?.nickname?.trim();
  const email = row.meta?.email?.trim() || null;
  return {
    sessionId: row.session_id,
    who: nickname || email || "Anonymous visitor",
    email,
    state: row.state ?? "unknown",
    preview: shorten(row.preview_message?.excerpt ?? row.last_message ?? ""),
    updatedAt: typeof row.updated_at === "number" ? new Date(row.updated_at) : null,
    unreadByUs: row.unread?.operator ?? 0,
    link: inboxLink(websiteId, row.session_id),
  };
}

type Fetch = typeof fetch;

async function listPages(config: CrispApiConfig, params: Record<string, string>, fetcher: Fetch): Promise<CrispConversation[]> {
  const auth = Buffer.from(`${config.identifier}:${config.key}`).toString("base64");
  const all: CrispConversation[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ per_page: String(PER_PAGE), ...params });
    const response = await fetcher(`${API}/website/${encodeURIComponent(config.websiteId)}/conversations/${page}?${query}`, {
      headers: { Authorization: `Basic ${auth}`, "X-Crisp-Tier": config.tier, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Crisp API answered ${response.status}`);
    const body = (await response.json()) as { error?: boolean; reason?: string; data?: CrispConversation[] };
    if (body.error) throw new Error(`Crisp API error: ${body.reason ?? "unknown"}`);
    const rows = Array.isArray(body.data) ? body.data : [];
    all.push(...rows);
    if (rows.length < PER_PAGE) break;
  }
  return all;
}

/** Conversations updated in the 24 hours before `now`, then every unresolved one; each once, newest first. */
export async function fetchDigestConversations(config: CrispApiConfig, now: Date = new Date(), fetcher: Fetch = fetch): Promise<DigestConversation[]> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [recent, open] = await Promise.all([
    listPages(config, { filter_date_start: since.toISOString(), filter_date_end: now.toISOString(), order_date_updated: "1" }, fetcher),
    listPages(config, { filter_not_resolved: "1", order_date_updated: "1" }, fetcher),
  ]);
  const seen = new Map<string, DigestConversation>();
  for (const row of [...recent, ...open]) {
    const item = toDigestConversation(config.websiteId, row);
    if (item && !seen.has(item.sessionId)) seen.set(item.sessionId, item);
  }
  return [...seen.values()].sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
}

const STATE_LABEL: Record<string, string> = { pending: "Pending", unresolved: "Unresolved", resolved: "Resolved" };

export function digestEmail(conversations: DigestConversation[], websiteId: string, now: Date): { subject: string; html: string; text: string } {
  const open = conversations.filter((c) => c.state !== "resolved").length;
  const date = now.toISOString().slice(0, 10);
  const subject = `Crisp: ${conversations.length} conversation${conversations.length === 1 ? "" : "s"}, ${open} not resolved (${date})`;
  const label = (c: DigestConversation) => STATE_LABEL[c.state] ?? c.state;
  const items = conversations
    .map(
      (c) =>
        `<li style="margin:0 0 12px 0;"><a href="${escapeHtml(c.link)}" style="color:#18181b;font-weight:600;">${escapeHtml(c.who)}</a>` +
        `${c.email && c.email !== c.who ? ` &lt;${escapeHtml(c.email)}&gt;` : ""} &middot; ${escapeHtml(label(c))}` +
        `${c.unreadByUs > 0 ? ` &middot; <strong>${c.unreadByUs} unread</strong>` : ""}` +
        `<br><span style="color:#52525b;">${escapeHtml(c.preview || "(no text)")}</span></li>`,
    )
    .join("");
  const inbox = `https://app.crisp.chat/website/${encodeURIComponent(websiteId)}/inbox/`;
  const html = emailLayout({
    heading: "Crisp: help and info requests",
    preheader: subject,
    body: [
      emailText(`Conversations updated in the last 24 hours, and every one not resolved yet. <strong>${open}</strong> still need an answer or a close.`),
      `<ul style="margin:0 0 8px 0;padding-left:18px;font-size:14px;line-height:1.5;color:#3f3f46;">${items}</ul>`,
      emailButton(inbox, "Open the Crisp inbox"),
      emailNote("Sent daily by RepGet when there is something in Crisp. Resolve a conversation in Crisp to drop it from tomorrow's list."),
    ].join(""),
  });
  const text = [
    "Conversations updated in the last 24 hours, and every one not resolved yet.",
    ...conversations.map((c) => `- ${c.who}${c.email && c.email !== c.who ? ` <${c.email}>` : ""} [${label(c)}${c.unreadByUs > 0 ? `, ${c.unreadByUs} unread` : ""}]\n  ${c.preview || "(no text)"}\n  ${c.link}`),
    `Inbox: ${inbox}`,
  ].join("\n\n");
  return { subject, html, text };
}

export type DigestResult = { status: "off" | "no_recipients" | "nothing" | "sent"; conversations: number; sent: number };

export async function sendCrispDigest(now: Date = new Date(), fetcher: Fetch = fetch): Promise<DigestResult> {
  const config = crispApiConfig();
  if (!config) return { status: "off", conversations: 0, sent: 0 };
  const to = adminEmails();
  if (to.length === 0) return { status: "no_recipients", conversations: 0, sent: 0 };
  const conversations = await fetchDigestConversations(config, now, fetcher);
  if (conversations.length === 0) return { status: "nothing", conversations: 0, sent: 0 };
  const email = digestEmail(conversations, config.websiteId, now);
  let sent = 0;
  for (const address of to) {
    const result = await sendEmail({ to: address, ...email, idempotencyKey: `crisp-digest:${now.toISOString().slice(0, 10)}:${address}` });
    if (result.ok) sent += 1;
  }
  return { status: "sent", conversations: conversations.length, sent };
}
