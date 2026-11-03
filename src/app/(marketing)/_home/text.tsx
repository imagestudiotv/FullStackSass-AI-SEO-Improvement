import { Fragment, type ReactNode } from "react";

import styles from "./home.module.css";

/**
 * The homepage copy's two marks (lib/i18n/home-redesign.ts):
 *  - `**words**` -> <strong>
 *  - `*word*`    -> the accent colour
 *
 * Anything else is plain text: the strings never carry HTML, so nothing here
 * can inject markup, and an unmatched mark is shown as written rather than
 * swallowing the rest of the sentence.
 */
export function rich(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    if (match[1] !== undefined) parts.push(<strong key={key++}>{match[1]}</strong>);
    else
      parts.push(
        <em key={key++} className={styles.accent}>
          {match[2]}
        </em>,
      );
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, i) => (typeof part === "string" ? <Fragment key={`t${i}`}>{part}</Fragment> : part));
}

/** The same text with its marks removed: for aria-labels, titles and alt text. */
export function plain(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, (_m, bold: string | undefined, accent: string | undefined) => bold ?? accent ?? "");
}
