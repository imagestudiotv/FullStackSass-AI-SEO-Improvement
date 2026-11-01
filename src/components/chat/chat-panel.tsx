"use client";

import { Check, ExternalLink, History, Loader2, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_PRICE, type ChatActionView } from "@/lib/chat/action-kinds";
import {
  cancelChatAction,
  confirmChatAction,
  deleteChatThread,
  loadChatThread,
  sendChatMessage,
  type ChatError,
} from "@/lib/chat/actions";
import { isChatPage, MAX_MESSAGE_CHARS } from "@/lib/chat/config";
import type { ChatMessageView, ChatThreadSummary } from "@/lib/chat/store";
import type { ChatCopy } from "@/lib/i18n/chat";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, plural } from "@/lib/i18n/format";

import { ChatMarkdown } from "./chat-markdown";

type Prices = { chat_message: number; audit_rerun: number; video_post: number };

type Props = {
  websiteId: string;
  canUse: boolean;
  locale: Locale;
  t: ChatCopy;
  creditsCount: string;
  freePerDay: number;
  initialFreeLeft: number;
  prices: Prices;
  initialThreads: ChatThreadSummary[];
};

function errorText(t: ChatCopy, creditsCount: string, result: { error: ChatError; price?: number; available?: number }): string {
  if (result.error === "not_enough_credits") {
    return format(t.errors.not_enough_credits, {
      price: plural(creditsCount, result.price ?? 0),
      available: plural(creditsCount, result.available ?? 0),
    });
  }
  return t.errors[result.error] ?? t.errors.generic;
}

export function ChatPanel(props: Props) {
  const { t, websiteId } = props;
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [threads, setThreads] = useState(props.initialThreads);
  const [freeLeft, setFreeLeft] = useState(props.initialFreeLeft);
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const [loading, startLoading] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const sent = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, sending]);

  const priceOf = (credits: number) => (credits > 0 ? plural(props.creditsCount, credits) : t.priceFree);

  function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    sent.current += 1;
    const pendingId = `pending-${sent.current}`;
    setMessages((current) => [...current, { id: pendingId, role: "user", text: question, links: [], actions: [], createdAt: "" }]);
    setDraft("");
    startSending(async () => {
      const result = await sendChatMessage(websiteId, { threadId, text: question }).catch(() => null);
      if (!result || !result.ok) {
        setMessages((current) => current.filter((message) => message.id !== pendingId));
        setDraft(question);
        toast.error(result ? errorText(t, props.creditsCount, result) : t.errors.generic);
        return;
      }
      setThreadId(result.data.threadId);
      setMessages(result.data.messages);
      setFreeLeft(result.data.freeLeft);
      const title = result.data.messages.find((message) => message.role === "user")?.text ?? question;
      setThreads((current) => [
        { id: result.data.threadId, title: current.find((thread) => thread.id === result.data.threadId)?.title ?? title.slice(0, 80), updatedAt: new Date().toISOString() },
        ...current.filter((thread) => thread.id !== result.data.threadId),
      ]);
    });
  }

  function open(id: string) {
    startLoading(async () => {
      const result = await loadChatThread(websiteId, id).catch(() => null);
      if (!result || !result.ok) {
        toast.error(result ? errorText(t, props.creditsCount, result) : t.errors.generic);
        if (result && !result.ok && result.error === "not_found") setThreads((current) => current.filter((thread) => thread.id !== id));
        return;
      }
      setThreadId(id);
      setMessages(result.data);
    });
  }

  function newChat() {
    setThreadId(null);
    setMessages([]);
    setDraft("");
  }

  function remove() {
    if (!threadId) return;
    const id = threadId;
    startLoading(async () => {
      const result = await deleteChatThread(websiteId, id).catch(() => null);
      if (!result || !result.ok) return void toast.error(t.errors.generic);
      setThreads((current) => current.filter((thread) => thread.id !== id));
      newChat();
    });
  }

  function updateAction(updated: ChatActionView) {
    setMessages((current) =>
      current.map((message) => ({ ...message, actions: message.actions.map((action) => (action.id === updated.id ? updated : action)) })),
    );
  }

  const counter =
    freeLeft > 0
      ? plural(t.freeLeft, freeLeft)
      : props.prices.chat_message > 0
        ? format(t.freeUsed, { price: plural(props.creditsCount, props.prices.chat_message) })
        : null;

  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="chat-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="chat-title" className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {t.title}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
        </div>
        {props.canUse ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={loading}>
                  <History aria-hidden="true" />
                  {t.history}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
                <DropdownMenuLabel>{t.history}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {threads.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">{t.noHistory}</p>
                ) : (
                  threads.map((thread) => (
                    <DropdownMenuItem key={thread.id} onSelect={() => open(thread.id)} className="flex flex-col items-start gap-0.5">
                      <span className="line-clamp-1 text-sm">{thread.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(thread.updatedAt, props.locale)}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {threadId ? (
              <Button variant="ghost" size="icon" onClick={remove} disabled={loading} aria-label={t.deleteChat} title={t.deleteChat}>
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={newChat} disabled={sending || messages.length === 0}>
              <Plus aria-hidden="true" />
              {t.newChat}
            </Button>
          </div>
        ) : null}
      </div>

      {!props.canUse ? (
        <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{t.errors.view_only}</p>
      ) : (
        <>
          {messages.length > 0 ? (
            <div className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto pr-1" aria-live="polite">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{message.text}</p>
                  </div>
                ) : (
                  <div key={message.id} className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-sm border bg-background px-4 py-3">
                    <ChatMarkdown text={message.text} />
                    {message.actions.map((action) => (
                      <ActionCard key={action.id} websiteId={websiteId} action={action} t={t} price={actionPrice(action, props.prices, priceOf, t)} onChange={updateAction} creditsCount={props.creditsCount} />
                    ))}
                    {message.links.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {message.links.map((link) => (
                          <Button key={link.href} asChild variant="outline" size="sm">
                            <Link href={link.href}>
                              <ExternalLink aria-hidden="true" />
                              {t.open}: {isChatPage(link.label) ? t.pages[link.label] : link.label}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ),
              )}
              {sending ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t.thinking}
                </p>
              ) : null}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {t.starters.map((starter) => (
                <Button key={starter} variant="secondary" size="sm" onClick={() => send(starter)} disabled={sending || loading}>
                  {starter}
                </Button>
              ))}
            </div>
          )}

          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              placeholder={t.placeholder}
              maxLength={MAX_MESSAGE_CHARS}
              rows={2}
              className="min-h-[2.75rem] resize-none"
              aria-label={t.placeholder}
              disabled={loading}
            />
            <Button type="submit" disabled={sending || loading || !draft.trim()} aria-label={t.send}>
              {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              <span className="hidden sm:inline">{t.send}</span>
            </Button>
          </form>
          <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {counter}
              {counter && props.prices.chat_message > 0 && freeLeft > 0 ? " · " : null}
              {props.prices.chat_message > 0 && freeLeft > 0
                ? format(t.allowance, { free: props.freePerDay, price: plural(props.creditsCount, props.prices.chat_message) })
                : null}
            </span>
            <span>
              {t.keepNote} {t.disclaimer}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function actionPrice(action: ChatActionView, prices: Prices, priceOf: (credits: number) => string, t: ChatCopy): string {
  const price = ACTION_PRICE[action.kind];
  if (price === "free") return t.priceFree;
  if (price === "article") return t.priceArticle;
  return priceOf(price.credits === "audit_rerun" ? prices.audit_rerun : price.credits === "video_post" ? prices.video_post : 0);
}

function ActionCard({
  websiteId,
  action,
  t,
  price,
  onChange,
  creditsCount,
}: {
  websiteId: string;
  action: ChatActionView;
  t: ChatCopy;
  price: string;
  onChange: (action: ChatActionView) => void;
  creditsCount: string;
}) {
  const [pending, start] = useTransition();
  const decide = (confirm: boolean) =>
    start(async () => {
      const result = await (confirm ? confirmChatAction : cancelChatAction)(websiteId, action.id).catch(() => null);
      if (!result || !result.ok) return void toast.error(result ? errorText(t, creditsCount, result) : t.errors.generic);
      onChange(result.data);
    });

  const added = action.outcome?.match(/^added:(\d+)$/);
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">{t.actions[action.kind]}</p>
      {action.details ? <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{action.details}</p> : null}
      {action.status === "proposed" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => decide(true)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {t.confirm} · {price}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide(false)} disabled={pending}>
            <X aria-hidden="true" />
            {t.cancel}
          </Button>
        </div>
      ) : (
        <p className={`mt-2 text-sm ${action.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          {action.status === "done"
            ? added
              ? `${t.done}: ${plural(t.topicsAdded, Number(added[1]))}`
              : t.done
            : action.status === "cancelled"
              ? t.cancelled
              : format(t.failed, { error: failureText(t, action.outcome) })}
        </p>
      )}
    </div>
  );
}

/** A failed action's reason: the codes the features return, in the reader's language; other text as it came. */
function failureText(t: ChatCopy, outcome: string | null): string {
  if (!outcome) return t.errors.generic;
  if (outcome === "not_enough_credits") return t.errors.not_enough_credits.replace(/:.*$/, "");
  if (outcome in t.errors) return t.errors[outcome as keyof ChatCopy["errors"]];
  return outcome;
}
