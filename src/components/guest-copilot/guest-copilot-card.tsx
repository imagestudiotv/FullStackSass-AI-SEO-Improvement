"use client";

import Link from "next/link";
import { useRef } from "react";

import type { Locale } from "@/lib/i18n/config";
import type { GuestCopilotCopy } from "@/lib/i18n/guest-copilot";

import { GuestCopilotChat, type GuestCopilotChatHandle } from "./guest-copilot-chat";
import styles from "./guest-copilot.module.css";

/** "Try the **AI** copilot free": the word between ** ** in bold, as in the design. */
function bold(text: string) {
  return text.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

const CHECK = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="m5 12 4 4L19 6" />
  </svg>
);

/**
 * The pitch and the chat side by side (components/guest-copilot/guest-copilot.tsx
 * picks the words). "Try the AI copilot free" goes to the tool page, or, on
 * the tool page itself (no `tryHref`), takes the visitor to the chat's field.
 * There the eyebrow is the page's h1, with the tool's name (`toolTitle`).
 */
export function GuestCopilotCard({
  copy,
  locale,
  tryHref,
  signUpHref,
  toolTitle,
  titleId,
}: {
  copy: GuestCopilotCopy;
  locale: Locale;
  tryHref: string | null;
  signUpHref: string;
  /** On the tool page: its name, as the page's h1. */
  toolTitle: string | null;
  titleId: string;
}) {
  const chat = useRef<GuestCopilotChatHandle>(null);
  const t = copy.section;

  return (
    <div className={styles.card}>
      <div className={styles.copy}>
        {toolTitle ? (
          <h1 className={styles.eyebrow}>
            <span className={styles["eyebrow-dot"]} aria-hidden="true" />
            {toolTitle}
          </h1>
        ) : (
          <p className={styles.eyebrow}>
            <span className={styles["eyebrow-dot"]} aria-hidden="true" />
            {t.eyebrow}
          </p>
        )}
        <h2 id={titleId} className={styles.title}>
          {t.titleLead} <span>{t.titleAccent}</span>
        </h2>
        <p className={styles.lead}>{t.lead}</p>
        <ul className={styles.proof}>
          {t.proof.map((item) => (
            <li key={item.lead}>
              {CHECK}
              <span>
                <strong>{item.lead}</strong> {item.text}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.buttons}>
          {tryHref ? (
            <Link prefetch={false} href={tryHref} className={`${styles.btn} ${styles["btn-primary"]}`}>
              {bold(t.tryFree)} <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button type="button" className={`${styles.btn} ${styles["btn-primary"]}`} onClick={() => chat.current?.focus()}>
              {bold(t.tryFree)} <span aria-hidden="true">↗</span>
            </button>
          )}
          <Link prefetch={false} href={signUpHref} className={`${styles.btn} ${styles["btn-second"]}`}>
            {t.unlock} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <p className={styles.note}>
          <strong>{t.noteStrong}</strong> {t.noteRest}
        </p>
      </div>
      <div className={styles.side}>
        <GuestCopilotChat ref={chat} copy={copy.chat} locale={locale} signUpHref={signUpHref} />
      </div>
    </div>
  );
}
