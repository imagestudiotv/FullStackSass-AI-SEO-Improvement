"use client";

import Link from "next/link";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import type { GuestRefusal, GuestTurn } from "@/lib/copilot/guest";
import { askGuestCopilotAction, guestCopilotRemainingAction } from "@/lib/copilot/guest-actions";
import type { Locale } from "@/lib/i18n/config";
import type { GuestCopilotCopy } from "@/lib/i18n/guest-copilot";

import styles from "./guest-copilot.module.css";

/** The free questions a day (lib/copilot/guest.ts GUEST_LIMITS.perVisitorPerDay); the server decides. */
const FREE = 3;
/** The longest question (GUEST_LIMITS.questionChars). */
const MAX_QUESTION = 750;
/** The website added, kept for this tab only. */
const WEBSITE_KEY = "repget-guest-copilot-website";

type Message =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "answer"; text: string }
  | { id: number; kind: "note"; text: string }
  | { id: number; kind: "error"; text: string };

export type GuestCopilotChatHandle = { focus: () => void };

/** The host of an address the visitor typed, or "" when it is not a public website. The server checks again. */
export function websiteHost(value: string): string {
  try {
    let raw = value.trim();
    if (!raw || /\s/.test(raw)) return "";
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.username || url.password || url.port || !host.includes(".") || host.length > 253) return "";
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /\.(local|internal|test|invalid|localhost)$/.test(host)) return "";
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The guest chat (client's design, 2026-11-11): an optional website, the
 * conversation, suggested questions, and after every answer an invitation to
 * sign up; once the free questions are used, a card that leads to sign-up.
 *
 * The server keeps the count (lib/copilot/guest.ts); the window asks it what
 * is left once the chat comes into view, and every answer says it again.
 * Answers are rendered by ChatMarkdown - React elements, never HTML.
 */
export const GuestCopilotChat = forwardRef<GuestCopilotChatHandle, { copy: GuestCopilotCopy["chat"]; locale: Locale; signUpHref: string }>(
  function GuestCopilotChat({ copy, locale, signUpHref }, ref) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [history, setHistory] = useState<GuestTurn[]>([]);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [website, setWebsite] = useState("");
    const [websiteDraft, setWebsiteDraft] = useState("");
    const [websiteError, setWebsiteError] = useState("");
    const [question, setQuestion] = useState("");
    const [busy, setBusy] = useState(false);

    const windowRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const websiteRef = useRef<HTMLInputElement>(null);
    const nextId = useRef(1);
    const asked = useRef(false);

    const closed = remaining === 0;
    const left = remaining ?? FREE;

    useImperativeHandle(ref, () => ({
      focus() {
        windowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        inputRef.current?.focus({ preventScroll: true });
      },
    }));

    // The website added earlier in this tab.
    useEffect(() => {
      try {
        const saved = sessionStorage.getItem(WEBSITE_KEY);
        if (saved && websiteHost(saved)) {
          setTimeout(() => {
            setWebsite(saved);
            // As in the design: the restored website is named in the chat.
            setMessages((current) => [...current, { id: nextId.current++, kind: "note", text: copy.welcomeBack.replace("{domain}", saved) }]);
          }, 0);
        }
      } catch {
        // Storage blocked: the visitor adds it again.
      }
      // Once, on arrival; push and the copy do not change between renders that matter here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // What is left, asked once the window is in view - not on every page view.
    useEffect(() => {
      const node = windowRef.current;
      if (!node || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || asked.current) return;
        asked.current = true;
        observer.disconnect();
        guestCopilotRemainingAction()
          .then((count) => setRemaining((current) => (current === null ? count : current)))
          .catch(() => {});
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    // The newest message (or the sign-up card) in view, inside the window only: the page itself never moves.
    useLayoutEffect(() => {
      const body = bodyRef.current;
      if (body && (messages.length > 0 || closed)) body.scrollTop = body.scrollHeight;
    }, [messages, busy, closed]);

    const push = (message: Omit<Message, "id">) => setMessages((current) => [...current, { ...message, id: nextId.current++ } as Message]);

    function refusal(reason: GuestRefusal): string {
      switch (reason) {
        case "too_long":
          return copy.errors.tooLong;
        case "website":
          return copy.errors.website;
        case "limit":
          return copy.errors.limit;
        case "busy":
          return copy.errors.busy;
        case "unavailable":
          return copy.errors.unavailable;
        default:
          return copy.errors.failed;
      }
    }

    async function ask(text: string) {
      const asking = text.trim();
      if (!asking || busy || closed) return;
      if (asking.length > MAX_QUESTION) {
        push({ kind: "error", text: copy.errors.tooLong });
        return;
      }
      setBusy(true);
      setQuestion("");
      push({ kind: "user", text: asking });
      try {
        const result = await askGuestCopilotAction({ question: asking, history, website: website || null, locale });
        if (result.ok) {
          push({ kind: "answer", text: result.reply });
          setHistory((current) => [...current, { role: "user" as const, content: asking }, { role: "assistant" as const, content: result.reply }].slice(-6));
          setRemaining(result.remaining);
        } else {
          if (result.remaining !== undefined) setRemaining(result.remaining);
          if (result.reason === "limit") setRemaining(0);
          else push({ kind: "error", text: refusal(result.reason) });
        }
      } catch {
        push({ kind: "error", text: copy.errors.failed });
      } finally {
        setBusy(false);
        setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
      }
    }

    function addWebsite(event: FormEvent) {
      event.preventDefault();
      const host = websiteHost(websiteDraft);
      if (!host) {
        setWebsiteError(copy.errors.website);
        websiteRef.current?.focus();
        return;
      }
      setWebsiteError("");
      setWebsite(host);
      setWebsiteDraft("");
      try {
        sessionStorage.setItem(WEBSITE_KEY, host);
      } catch {
        // Kept for this page only.
      }
      push({ kind: "note", text: copy.websiteAdded.replace("{domain}", host) });
      inputRef.current?.focus({ preventScroll: true });
    }

    function changeWebsite() {
      setWebsite("");
      try {
        sessionStorage.removeItem(WEBSITE_KEY);
      } catch {
        // Nothing kept.
      }
      push({ kind: "note", text: copy.websiteChanged });
      setTimeout(() => websiteRef.current?.focus(), 0);
    }

    function submit(event: FormEvent) {
      event.preventDefault();
      void ask(question);
    }

    function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void ask(question);
      }
    }

    const tries = closed ? copy.triesNone : left === 1 ? copy.triesOne : copy.triesMany.replace("{n}", String(left));
    const [counterLead, counterRest] = copy.counter.split("{n}");
    const placeholder = closed ? copy.placeholderClosed : website ? copy.placeholderSite.replace("{domain}", website) : copy.placeholder;
    const websiteId = "guest-copilot-website";

    return (
      <div ref={windowRef} className={styles.window} role="region" aria-label={copy.label}>
        <div className={styles.top}>
          <div className={styles["top-left"]}>
            <div className={styles.logo} aria-hidden="true">
              ✳
            </div>
            <div className={styles.name}>
              {copy.name}
              <span>{copy.by}</span>
            </div>
          </div>
          <div className={styles["top-right"]}>
            <span className={styles.status}>
              <span className={styles.pulse} aria-hidden="true" />
              {copy.status}
            </span>
            <span className={styles.remaining}>{tries}</span>
          </div>
        </div>

        <div className={styles.site}>
          <div className={styles["site-label"]}>
            {website ? (
              <span>{copy.yourWebsite}</span>
            ) : (
              <label htmlFor={websiteId}>
                {copy.websiteTitle} <em>{copy.optional}</em>
              </label>
            )}
            <span className={styles.mode}>{copy.guestAccess}</span>
          </div>
          {website ? (
            <div className={styles.selected}>
              <span className={styles["selected-name"]}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                <span>{website}</span>
              </span>
              <button type="button" onClick={changeWebsite}>
                {copy.changeWebsite}
              </button>
            </div>
          ) : (
            <>
              <form className={styles["site-form"]} onSubmit={addWebsite} noValidate>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
                </svg>
                <input
                  ref={websiteRef}
                  id={websiteId}
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  maxLength={200}
                  placeholder={copy.websitePlaceholder}
                  value={websiteDraft}
                  onChange={(event) => setWebsiteDraft(event.target.value)}
                  aria-invalid={websiteError ? true : undefined}
                  aria-describedby={websiteError ? `${websiteId}-error` : undefined}
                />
                <button type="submit">
                  {copy.addWebsite} <span aria-hidden="true">→</span>
                </button>
              </form>
              {websiteError ? (
                <div id={`${websiteId}-error`} className={styles["site-error"]} role="alert">
                  {websiteError}
                </div>
              ) : null}
              <div className={styles.skip}>
                <span>{copy.skipLead}</span>
                <button
                  type="button"
                  onClick={() => {
                    setWebsiteError("");
                    inputRef.current?.focus({ preventScroll: true });
                    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }}
                >
                  {copy.skip} <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div ref={bodyRef} className={styles.body} role="log" aria-live="polite">
          <Bot sender={copy.sender}>
            <div className={styles.bubble}>{copy.greeting}</div>
          </Bot>
          {/* The suggestions stay under the greeting, as in the design; they are off while an answer is written and once none are left. */}
          <div className={styles.chips}>
            {copy.chips.map((chip) => (
              <button key={chip} type="button" disabled={busy || closed} onClick={() => void ask(chip)}>
                {chip}
              </button>
            ))}
          </div>
          {messages.map((message) =>
            message.kind === "user" ? (
              <div key={message.id} className={`${styles.row} ${styles["row-user"]}`}>
                <div className={styles.content}>
                  <span className={styles["sr-only"]}>{copy.you}: </span>
                  <div className={styles.bubble}>{message.text}</div>
                </div>
              </div>
            ) : (
              <Bot key={message.id} sender={copy.sender}>
                {message.kind === "answer" ? (
                  <>
                    <div className={`${styles.bubble} ${styles["bubble-answer"]}`}>
                      <ChatMarkdown text={message.text} />
                    </div>
                    <div className={styles["reply-cta"]}>
                      <div className={styles["reply-cta-copy"]}>
                        <strong>{copy.replyCtaTitle}</strong>
                        <span>{copy.replyCtaText}</span>
                      </div>
                      <Link prefetch={false} className={styles["reply-cta-link"]} href={signUpHref}>
                        {copy.replyCtaLink} <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className={message.kind === "error" ? `${styles.bubble} ${styles["bubble-error"]}` : styles.bubble}>{message.text}</div>
                )}
              </Bot>
            ),
          )}
          {busy ? (
            <Bot sender={copy.sender}>
              <div className={styles.typing}>
                <span />
                <span />
                <span />
                <span className={styles["sr-only"]}>{copy.writing}</span>
              </div>
            </Bot>
          ) : null}
          {closed ? (
            <div className={styles.gate}>
              <h3>{copy.gateTitle}</h3>
              <p>{copy.gateText}</p>
              <Link prefetch={false} href={signUpHref}>
                {copy.gateButton} <span aria-hidden="true">↗</span>
              </Link>
              <small>{copy.gateSmall}</small>
            </div>
          ) : null}
        </div>

        <div className={styles.bottom}>
          <form className={styles.form} onSubmit={submit}>
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={MAX_QUESTION}
              value={question}
              placeholder={placeholder}
              aria-label={copy.inputLabel}
              disabled={closed || busy}
              onChange={(event) => {
                setQuestion(event.target.value);
                event.target.style.height = "32px";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 96)}px`;
              }}
              onKeyDown={keyDown}
            />
            <button className={styles.send} type="submit" aria-label={copy.send} disabled={closed || busy || !question.trim()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m4 12 16-8-6 16-2.5-7.5L4 12Zm7.5.5L20 4" />
              </svg>
            </button>
          </form>
          <div className={styles.footer}>
            <span>
              {counterLead}
              <strong>{left}</strong>
              {counterRest}
            </span>
            <span>{copy.noSignup}</span>
          </div>
        </div>
      </div>
    );
  },
);

function Bot({ sender, children }: { sender: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.avatar} aria-hidden="true">
        ✳
      </div>
      <div className={styles.content}>
        <div className={styles.sender}>{sender}</div>
        {children}
      </div>
    </div>
  );
}
