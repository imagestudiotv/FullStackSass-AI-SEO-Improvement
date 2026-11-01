import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * The assistant's answers: a small part of Markdown - paragraphs, lists,
 * headings, **bold**, `code` and links - turned into React elements, never
 * into HTML, so nothing in an answer can run or style the page. A link is
 * kept only when it points inside RepGet ("/..."); any other address is shown
 * as plain text.
 */
export function ChatMarkdown({ text }: { text: string }) {
  return <div className="space-y-2 text-sm leading-relaxed">{blocks(text)}</div>;
}

type Block = { kind: "p"; text: string } | { kind: "h"; text: string } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] };

export function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      out.push({ kind: "h", text: heading[1] });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? "ul" : "ol";
      const last = out[out.length - 1];
      const item = (bullet ?? numbered)![1];
      if (last && last.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return out;
}

function blocks(text: string): ReactNode[] {
  return parseBlocks(text).map((block, index) => {
    if (block.kind === "h") return <p key={index} className="font-semibold">{inline(block.text)}</p>;
    if (block.kind === "p") return <p key={index}>{inline(block.text)}</p>;
    const List = block.kind === "ul" ? "ul" : "ol";
    return (
      <List key={index} className={block.kind === "ul" ? "list-disc space-y-1 pl-5" : "list-decimal space-y-1 pl-5"}>
        {block.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </List>
    );
  });
}

/** An address inside RepGet: "/..." but not "//host" or "/\host". */
export function isInternalHref(href: string): boolean {
  return /^\/(?![/\\])/.test(href) && !/[\s<>"']/.test(href);
}

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${at}`;
    if (match[2] !== undefined) out.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3] !== undefined) out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 text-xs">{match[3]}</code>);
    else if (isInternalHref(match[5])) {
      out.push(
        <Link key={key} href={match[5]} className="font-medium text-primary underline underline-offset-2">
          {match[4]}
        </Link>,
      );
    } else out.push(<Fragment key={key}>{match[4]}</Fragment>);
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
