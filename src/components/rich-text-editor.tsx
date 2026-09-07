"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The article body editor.
 *
 * Articles were edited as raw HTML in a monospace textarea. The people using
 * this are business owners, not developers — one deleted </p> and the article
 * publishes to their live site with the rest of it swallowed by an unclosed
 * tag, with nothing in the page to say what went wrong.
 *
 * Tiptap rather than Quill. Quill formats through its own classes
 * (ql-size-large) and wrapper divs, which survive sanitising and then land on a
 * customer's site that has no stylesheet for them; article stats are also
 * counted from the HTML with regex, so div-and-class markup would quietly skew
 * the heading and link counts. Tiptap round-trips the plain semantic tags the
 * generator already writes. It is also the only one of the two whose published
 * package supports React 19 — react-quill peers cap at ^18 and it still calls
 * findDOMNode, removed in 19.
 *
 * The toolbar carries what an article needs and nothing more. No font sizes,
 * colours or alignment: those would be inline styles the sanitiser strips on
 * save, so offering them would be offering a button that silently does
 * nothing. Headings start at H2 because the title is the page's H1.
 */

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      // Toolbar buttons inside a form would submit it.
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "size-8 p-0",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");

    // Cancel leaves the document alone; clearing the box removes the link.
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted/40 p-1">
      <ToolbarButton
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      {/* H2 and H3 only: the article title is the page's H1. */}
      <ToolbarButton
        label="Heading"
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label="Bulleted list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
      >
        <Code className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label="Add link"
        onClick={setLink}
        active={editor.isActive("link")}
      >
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Remove link"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
      >
        <Link2Off className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel = "Article content",
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
}) {
  /**
   * The raw HTML stays reachable behind a toggle. Someone occasionally needs
   * to paste an embed or fix markup by hand, and taking that away to add the
   * toolbar would be a net loss for the people who could already do it.
   */
  const [showSource, setShowSource] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The title is the H1; a second one competes with it, and the
        // sanitiser rewrites it to H2 anyway.
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        // rel and target are applied by the sanitiser on save, so pasted
        // links get them too — not just ones added through the toolbar.
        HTMLAttributes: { rel: "noopener nofollow", target: "_blank" },
      }),
      Image.configure({ inline: false }),
    ],
    content: value,
    // Next renders this on the server first; without it React reports a
    // hydration mismatch on every article page.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        /**
         * Explicit child selectors rather than `prose`:
         * @tailwindcss/typography is not installed, so the prose class is inert
         * here and headings would render at body size. This mirrors how the
         * preview tab styles the same HTML, so the two views agree.
         */
        class:
          "min-h-[28rem] px-3 py-2 text-sm focus:outline-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_img]:my-3 [&_img]:rounded-md",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  /**
   * Pull in content that changed underneath us — a rewrite finishing, or the
   * source textarea being edited. Guarded on inequality: writing the editor's
   * own output back would move the cursor to the start on every keystroke.
   */
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    // Matches the editor's height so the card does not jump on mount.
    return (
      <div className="min-h-[30rem] rounded-md border border-input bg-muted/20" />
    );
  }

  return (
    <div>
      <Toolbar editor={editor} />

      {showSource ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={20}
          aria-label="Article HTML"
          className="flex w-full rounded-b-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="rounded-b-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        />
      )}

      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {showSource
            ? "Editing the HTML directly. Anything unsafe is removed when you save."
            : "Formatting is kept simple so it matches your site's own styling."}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowSource((previous) => !previous)}
          className="h-7 text-xs"
        >
          {showSource ? "Back to editor" : "Edit HTML"}
        </Button>
      </div>
    </div>
  );
}
