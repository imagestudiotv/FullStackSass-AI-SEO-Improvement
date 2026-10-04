"use client";

import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Extension, type Extensions } from "@tiptap/core";
import {
  Bold,
  Code,
  ImagePlus,
  Loader2,
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
  type LucideIcon,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePicker, type PickerImage } from "@/components/image-picker";
import { cn } from "@/lib/utils";
import { getMessages, type Messages } from "@/lib/i18n/messages";

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

/**
 * Keeps a heading's id through editing.
 *
 * The contents list links to "#heading-id", and Tiptap's heading node drops
 * every attribute it does not know - so one save in the editor used to strip
 * the ids and leave every contents link pointing nowhere. The sanitiser still
 * decides which ids survive (safe slugs only), and the publishing path
 * repairs any that are missing (lib/articles/toc.ts).
 */
const HeadingIds = Extension.create({
  name: "headingIds",
  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("id"),
            renderHTML: (attributes) => (attributes.id ? { id: attributes.id } : {}),
          },
        },
      },
    ];
  },
});

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

/** Adds, changes or removes the link at the caret, through the browser's prompt (the classic and compact toolbars). */
function promptForLink(editor: Editor) {
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
}

function Toolbar({
  editor,
  onInsertImage,
  uploading,
  t,
}: {
  editor: Editor;
  /** Opens the file picker. Absent when the page cannot store images. */
  onInsertImage?: () => void;
  uploading: boolean;
  /** The toolbar's wording. */
  t: Messages["app"]["editorUi"];
}) {
  const setLink = useCallback(() => promptForLink(editor), [editor]);

  return (
    /*
      Sticky, because an article runs to a few thousand words and the toolbar
      scrolled out of view — bolding a word halfway down meant scrolling back
      to the top and losing your place.

      top-14 clears the app header, which is h-14 and sticky itself; z-30 sits
      under that header (z-40) so the toolbar slides beneath it rather than
      over it, and above the article text.

      An opaque background, not the muted/40 it had: a translucent bar over
      scrolling text is unreadable.
    */
    <div className="sticky top-14 z-30 flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted p-1">
      <ToolbarButton
        label={t.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      {/* H2 and H3 only: the article title is the page's H1. */}
      <ToolbarButton
        label={t.heading}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.subheading}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label={t.bulletedList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.numberedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
      >
        <Code className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label={t.addLink}
        onClick={setLink}
        active={editor.isActive("link")}
      >
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.removeLink}
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
      >
        <Link2Off className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      {onInsertImage ? (
        <>
          <ToolbarButton
            label={t.insertImage}
            onClick={onInsertImage}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        </>
      ) : null}

      <ToolbarButton
        label={t.undo}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.redo}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

/**
 * The compact toolbar: the classic buttons a short answer needs, in the
 * classic order, and nothing COMPACT_EXTENSIONS could not hold.
 *
 * Not sticky. A page stacks several of these (one per FAQ answer), and
 * sticky bars would pile up under the top bar as it scrolls; an answer is
 * short enough that its toolbar never scrolls out of reach. States are read
 * live, as the workspace toolbar reads them, so Bold shows as such wherever
 * the caret moves.
 */
function CompactToolbar({
  editor,
  disabled,
  t,
  label,
}: {
  editor: Editor;
  disabled: boolean;
  t: Messages["app"]["editorUi"];
  /** The editor's name ("Answer 2"), so each answer's buttons are told apart. */
  label: string;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  return (
    /*
      A named group: a page holds one of these per answer, and a screen
      reader's list of buttons would otherwise be many identical "Bold"s with
      nothing tying one to its answer. A group, not a toolbar - role=toolbar
      promises arrow-key movement between buttons, which this does not have.
    */
    <div
      role="group"
      aria-label={`${label}: ${t.toolbarLabel}`}
      className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted p-1"
    >
      <ToolbarButton
        label={t.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={state.bold}
        disabled={disabled}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={state.italic}
        disabled={disabled}
      >
        <Italic className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label={t.bulletedList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={state.bullet}
        disabled={disabled}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.numberedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={state.ordered}
        disabled={disabled}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label={t.addLink}
        onClick={() => promptForLink(editor)}
        active={state.link}
        disabled={disabled}
      >
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.removeLink}
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={disabled || !state.link}
      >
        <Link2Off className="size-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <ToolbarButton
        label={t.undo}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={disabled || !state.canUndo}
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t.redo}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={disabled || !state.canRedo}
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

/**
 * An image's real width and height, read by loading it, or null when it
 * cannot be read in time.
 */
function measureImage(
  src: string,
  timeoutMs = 15000,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const probe = new window.Image();
    const finish = (size: { width: number; height: number } | null) => {
      window.clearTimeout(timer);
      probe.onload = null;
      probe.onerror = null;
      resolve(size);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    probe.onload = () =>
      finish(
        probe.naturalWidth > 0 && probe.naturalHeight > 0
          ? { width: probe.naturalWidth, height: probe.naturalHeight }
          : null,
      );
    probe.onerror = () => finish(null);
    probe.src = src;
  });
}

/**
 * Gives every unsized copy of a picture its real width and height, so the
 * saved <img> carries width="..." height="..." (client's launch review,
 * 2026-10-03). Without them a browser cannot hold the picture's space while
 * it loads, and the text below jumps when it arrives - layout shift, which
 * PageSpeed penalises. The numbers set the shape only; CSS (max-width:100%;
 * height:auto) still fits the picture to the column.
 *
 * Called just after the picture is put in, not before: inserting stays
 * instant, a second press cannot insert it twice while a measurement is
 * pending, and no stored position can go stale. The picture is found by its
 * address instead, and only where it has no size yet, so nothing deliberate
 * is overwritten. Kept out of undo history: undoing the insert removes the
 * picture, and there is no separate "size" step to undo.
 *
 * A picture that cannot be read keeps no size, exactly as before.
 */
function recordImageSize(editor: Editor | null, src: string) {
  void measureImage(src).then((size) => {
    if (!size || !editor || editor.isDestroyed) return;
    const { tr } = editor.state;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "image" && node.attrs.src === src && node.attrs.width == null && node.attrs.height == null) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...size });
      }
    });
    if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
  });
}

/**
 * The size attributes a replaced picture keeps. A different picture drops the
 * old one's size - its shape is unknown until recordImageSize reads it, and a
 * wrong shape is worse than none. The same picture (only its description
 * changed) keeps its size.
 */
function replacedSize(previousSrc: string, src: string): { width?: null; height?: null } {
  return previousSrc === src ? {} : { width: null, height: null };
}

/**
 * What a typed link address becomes: the href to set, "" to remove the link,
 * or null when it cannot be a link. Mirrors the sanitiser's rule (http,
 * https, mailto and tel, or a relative address) so a link that would vanish
 * on save is refused here, with a reason, instead. A bare domain such as
 * "example.com/page" gets https:// - what someone typing it means.
 */
export function linkHref(input: string): string | null {
  const value = input.trim();
  if (value === "") return "";
  if (/\s/.test(value)) return null;
  if (/^https?:\/\/[^/?#]+/i.test(value)) return value;
  if (/^(mailto|tel):.+/i.test(value)) return value;
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) return value;
  // Any other scheme (javascript:, data:, ftp:) is not a link an article may carry.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  if (/^[^/?#]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(value)) return `https://${value}`;
  return null;
}

type ToolItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** A toggle's state (aria-pressed). Absent for plain actions. */
  pressed?: boolean;
  /** Shown as current without being a toggle (the caret is on a link). */
  current?: boolean;
  disabled?: boolean;
  busy?: boolean;
};

/**
 * The toolbar of the workspace variant: the same commands as the classic
 * one, in labelled groups, as one ARIA toolbar (a single Tab stop; arrow
 * keys, Home and End move along it), with its active states read live from
 * the editor so Bold or a link shows as such wherever the caret moves.
 *
 * The sticky offset and stacking are the classic toolbar's (top-14 under
 * the customer header, z-30 under it).
 */
function WorkspaceToolbar({
  editor,
  onInsertImage,
  onEditLink,
  uploading,
  disabled,
  t,
}: {
  editor: Editor;
  onInsertImage?: () => void;
  onEditLink: () => void;
  uploading: boolean;
  /** Everything off: HTML mode, or editing paused. */
  disabled: boolean;
  t: Messages["app"]["editorUi"];
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState("bold");

  const chain = () => editor.chain().focus();
  const groups: { label: string; items: ToolItem[] }[] = [
    {
      label: t.groupText,
      items: [
        { key: "bold", label: t.bold, icon: Bold, pressed: state.bold, onClick: () => chain().toggleBold().run() },
        { key: "italic", label: t.italic, icon: Italic, pressed: state.italic, onClick: () => chain().toggleItalic().run() },
        { key: "strike", label: t.strikethrough, icon: Strikethrough, pressed: state.strike, onClick: () => chain().toggleStrike().run() },
      ],
    },
    {
      label: t.groupHeadings,
      items: [
        { key: "h2", label: t.heading, icon: Heading2, pressed: state.h2, onClick: () => chain().toggleHeading({ level: 2 }).run() },
        { key: "h3", label: t.subheading, icon: Heading3, pressed: state.h3, onClick: () => chain().toggleHeading({ level: 3 }).run() },
      ],
    },
    {
      label: t.groupBlocks,
      items: [
        { key: "bullet", label: t.bulletedList, icon: List, pressed: state.bullet, onClick: () => chain().toggleBulletList().run() },
        { key: "ordered", label: t.numberedList, icon: ListOrdered, pressed: state.ordered, onClick: () => chain().toggleOrderedList().run() },
        { key: "quote", label: t.quote, icon: Quote, pressed: state.quote, onClick: () => chain().toggleBlockquote().run() },
        { key: "code", label: t.code, icon: Code, pressed: state.code, onClick: () => chain().toggleCode().run() },
      ],
    },
    {
      label: t.groupLinks,
      items: [
        { key: "link", label: t.addLink, icon: Link2, current: state.link, onClick: onEditLink },
        {
          key: "unlink",
          label: t.removeLink,
          icon: Link2Off,
          disabled: !state.link,
          onClick: () => chain().extendMarkRange("link").unsetLink().run(),
        },
      ],
    },
    ...(onInsertImage
      ? [
          {
            label: t.groupMedia,
            items: [
              {
                key: "image",
                label: t.insertImage,
                icon: uploading ? Loader2 : ImagePlus,
                busy: uploading,
                disabled: uploading,
                onClick: onInsertImage,
              },
            ],
          },
        ]
      : []),
    {
      label: t.groupHistory,
      items: [
        { key: "undo", label: t.undo, icon: Undo2, disabled: !state.canUndo, onClick: () => chain().undo().run() },
        { key: "redo", label: t.redo, icon: Redo2, disabled: !state.canRedo, onClick: () => chain().redo().run() },
      ],
    },
  ];

  // One Tab stop: the last focused button, or the first that can be used.
  const usable = groups.flatMap((group) => group.items).filter((item) => !disabled && !item.disabled).map((item) => item.key);
  const tabKey = usable.includes(focusKey) ? focusKey : usable[0];

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key) || !toolbarRef.current) return;
    const buttons = Array.from(toolbarRef.current.querySelectorAll<HTMLButtonElement>("button[data-tool]:not(:disabled)"));
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t.toolbarLabel}
      onKeyDown={onKeyDown}
      className="sticky top-14 z-30 flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted p-1"
    >
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 ? <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" /> : null}
          <div role="group" aria-label={group.label} className="flex flex-wrap items-center gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const highlighted = item.pressed || item.current;
              return (
                <Button
                  key={item.key}
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-tool={item.key}
                  tabIndex={item.key === tabKey ? 0 : -1}
                  onFocus={() => setFocusKey(item.key)}
                  onClick={item.onClick}
                  disabled={disabled || item.disabled}
                  aria-label={item.label}
                  aria-pressed={item.pressed}
                  title={item.label}
                  className={cn(
                    "size-8 p-0",
                    // Visible on the muted bar (the classic accent is the same grey as the bar).
                    highlighted && "bg-background text-foreground shadow-xs ring-1 ring-border hover:bg-background",
                  )}
                >
                  <Icon className={cn("size-4", item.busy && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
                </Button>
              );
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Adding or changing a link, in a dialog rather than the browser's own
 * prompt (which is English, unstyled and cannot explain a refusal).
 */
function LinkDialog({
  open,
  initial,
  hasLink,
  onApply,
  onRemove,
  onClose,
  onCloseAutoFocus,
  t,
  tCommon,
}: {
  open: boolean;
  initial: string;
  hasLink: boolean;
  onApply: (href: string) => void;
  onRemove: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  t: Messages["app"]["editorUi"];
  tCommon: Messages["app"]["common"];
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const inputId = `${id}-href`;
  const errorId = `${id}-error`;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = linkHref(value);
    if (href === "") {
      if (hasLink) onRemove();
      else onClose();
      return;
    }
    if (href === null) {
      setError(t.linkInvalid);
      return;
    }
    onApply(href);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="sm:max-w-md motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
      >
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.linkDialogTitle}</DialogTitle>
            <DialogDescription>{t.linkDialogHelp}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>{t.linkUrlLabel}</Label>
            <Input
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            {hasLink ? (
              <Button type="button" variant="ghost" onClick={onRemove} className="sm:mr-auto">
                {t.removeLink}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon.cancel}
            </Button>
            <Button type="submit">{t.linkApply}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The editable area's classes, shared by both variants. */
const CONTENT_CLASSES = `${ARTICLE_TABLE_CLASSES} min-h-[28rem] px-3 py-2 text-sm focus:outline-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_img]:my-6 [&_img]:block [&_img]:mx-auto [&_img]:max-w-[min(100%,36rem)] [&_img]:max-h-[30rem] [&_img]:h-auto [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:object-contain`;

/**
 * The compact editable area: a few lines high rather than a page, and styled
 * for the little it can hold. Paragraphs inside list items stay tight.
 */
const COMPACT_CONTENT_CLASSES =
  "min-h-24 px-3 py-2 text-sm focus:outline-none [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li_p]:my-0 [&_a]:text-primary [&_a]:underline";

/**
 * What the compact editor can hold: paragraphs, bold, italic, links and
 * lists - exactly what its toolbar makes.
 *
 * The schema is cut down, not just the toolbar, because a paste brings
 * whatever the copied page had: ProseMirror keeps only what the schema has a
 * place for, so a pasted heading, quote or table keeps its words as plain
 * paragraphs and a picture is left out. Hiding the buttons alone would have
 * let a pasted <h2> into a FAQ answer with no button to turn it back into
 * text. Line breaks (Shift+Enter) stay: they are typing, not formatting.
 *
 * Created once, here: an extension instance holds configuration only (each
 * editor gets its own storage), so every compact editor on a page shares it.
 * Exported for the schema test.
 */
export const COMPACT_EXTENSIONS: Extensions = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    // The Link below is the only one wanted, as in the workspace variant.
    link: false,
    /*
      No empty paragraph kept after a closing list. The sanitiser strips that
      paragraph on save, so a saved answer ending in a list came back without
      it, and the first transaction after loading - the one a click or Tab
      into the answer makes - put it back: an edit nobody made, which marked
      the post "Unsaved changes" and asked before leaving. Enter on an empty
      last list item still leaves the list, for text after it.
    */
    trailingNode: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    // As the full editor's: the sanitiser sets rel and target on save.
    HTMLAttributes: { rel: "noopener nofollow", target: "_blank" },
  }),
];

export function RichTextEditor({
  value,
  onChange,
  ariaLabel = "Article content",
  onUploadImage: uploadImageProp,
  onListImages,
  t = getMessages("en").app.editorUi,
  variant = "classic",
  toolbar = "full",
  tCommon,
  editable = true,
  contentClassName,
  describedBy,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
  /**
   * "classic" (the default) is the editor exactly as the admin article,
   * network review and blog editors use it - their sticky offsets target its
   * toolbar classes. "workspace" is opt-in for the customer article page: a
   * grouped, keyboard-navigable toolbar with live states, a link dialog in
   * place of the browser prompt, the image picker in an accessible dialog
   * (focus trap, Escape, focus return), translated picker and HTML-mode
   * text, and no duplicate link extension.
   */
  variant?: "classic" | "workspace";
  /**
   * "full" (the default) is the article editor. "compact" is opt-in, for a
   * short piece of text inside a form (a FAQ answer): bold, italic, lists and
   * links only - in the toolbar and in what the editor can hold
   * (COMPACT_EXTENSIONS) - a few lines high, a toolbar that does not stick,
   * no HTML view and no pictures. Classic variant only.
   */
  toolbar?: "full" | "compact";
  /** Shared words for the picker (Cancel, Remove, Upload, search). Workspace variant. */
  tCommon?: Messages["app"]["common"];
  /** False pauses editing (contenteditable off, toolbar off). Defaults to true. */
  editable?: boolean;
  /** Extra classes on the editable area, e.g. a reading width. Workspace variant. */
  contentClassName?: string;
  /** Id of a hint describing the editor. Workspace variant. */
  describedBy?: string;
  /**
   * The toolbar's wording, defaulting to English.
   *
   * Optional for the same reason StatusBadge's is: this editor is rendered
   * from client trees that do not all hold a dictionary, and an unwired
   * caller should keep showing words rather than nothing.
   */
  t?: Messages["app"]["editorUi"];
  /**
   * Stores an image and returns a URL to put in the body.
   *
   * Without it, pasting or dropping a picture inserts a data: URL, which the
   * sanitiser strips on save — the image looked fine while editing and was
   * gone afterwards, with nothing to say why. A data URL can carry an SVG
   * with script in it, so that rule stays and the bytes are uploaded instead.
   */
  onUploadImage?: (file: File) => Promise<string | null>;
  /** Pictures this website has used before, optionally filtered. */
  onListImages?: (term: string) => Promise<PickerImage[]>;
}) {
  const compact = toolbar === "compact" && variant === "classic";
  /*
    The compact editor has no image node, so an upload would have nowhere to
    land (and setImage no command to run): pasted and dropped pictures fall
    through to the editor, which leaves them out, whatever a caller passes.
  */
  const onUploadImage = compact ? undefined : uploadImageProp;

  /**
   * The raw HTML stays reachable behind a toggle. Someone occasionally needs
   * to paste an embed or fix markup by hand, and taking that away to add the
   * toolbar would be a net loss for the people who could already do it.
   */
  const [showSource, setShowSource] = useState(false);
  /** True while a pasted or chosen image is being stored. */
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * The image being replaced, when the panel was opened by clicking one.
   * Null means insert at the caret instead.
   */
  const [editingImage, setEditingImage] = useState<string | null>(null);
  /** That image's description (alt text), shown in the panel to edit. */
  const [editingAlt, setEditingAlt] = useState<string | null>(null);
  /**
   * Document position of the image being edited.
   *
   * Needed because returning true from handleClickOn stops Tiptap making its
   * own selection: without a position, Replace and Remove had nothing to act
   * on and silently did nothing.
   */
  const editingPosRef = useRef<number | null>(null);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  /**
   * Loads suggestions when the panel opens, and again on each search.
   *
   * Held here rather than in the picker so the picker stays a presentational
   * component: it knows how to lay out images and nothing about where they
   * come from, which is what lets a stock provider be added later without
   * touching it.
   */
  const loadImages = useCallback(
    async (term: string) => {
      if (!onListImages) return;
      setPickerLoading(true);
      try {
        setPickerImages(await onListImages(term));
      } finally {
        setPickerLoading(false);
      }
    },
    [onListImages],
  );

  /**
   * Uploads a file and puts the resulting image in the document.
   *
   * Declared with useCallback and read through a ref inside the editor's
   * handlers, because those close over the first render otherwise and would
   * call a stale editor instance.
   */
  const editorRef = useRef<Editor | null>(null);
  /**
   * editorProps is captured when the editor is created, so a handler defined
   * there closes over the first render's openPicker. Reading through a ref
   * keeps clicking an image working after any re-render.
   */
  const openPickerRef = useRef<((replacing?: string, alt?: string | null) => void) | null>(null);

  const insertUploaded = useCallback(
    async (file: File) => {
      if (!onUploadImage) return;

      setUploading(true);
      try {
        const url = await onUploadImage(file);
        if (url) {
          editorRef.current?.chain().focus().setImage({ src: url }).run();
          recordImageSize(editorRef.current, url);
        }
      } finally {
        setUploading(false);
      }
    },
    [onUploadImage],
  );

  const workspace = variant === "workspace";
  /** Workspace variant: the element to focus when a dialog closes, and whether the editor should get it instead. */
  const pickerReturnRef = useRef<HTMLElement | null>(null);
  const focusEditorOnCloseRef = useRef(false);
  const linkReturnRef = useRef<HTMLElement | null>(null);
  const [link, setLink] = useState({ open: false, initial: "", hasLink: false, key: 0 });
  const sourceHintId = useId();

  /**
   * Opens the panel beside whatever the customer is pointing at.
   *
   * The offset is measured from the editor's own box rather than the viewport,
   * because the panel is absolutely positioned inside it — a viewport
   * coordinate would drift as soon as the page scrolled.
   */
  const openPicker = useCallback((replacing?: string, alt?: string | null) => {
    // Where focus goes back to when the workspace dialog closes without a change.
    pickerReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusEditorOnCloseRef.current = false;
    setEditingImage(replacing ?? null);
    setEditingAlt(replacing ? (alt ?? null) : null);
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    openPickerRef.current = openPicker;
  }, [openPicker]);

  /** Opens at the caret, for the toolbar button. */
  const openPickerAtCaret = useCallback(() => openPicker(), [openPicker]);

  const editor = useEditor({
    extensions: compact ? COMPACT_EXTENSIONS : [
      StarterKit.configure(
        workspace
          ? // StarterKit 3 bundles Link too; the one configured below is the only one wanted.
            { heading: { levels: [2, 3, 4] }, link: false }
          : {
              // The title is the H1; a second one competes with it, and the
              // sanitiser rewrites it to H2 anyway.
              heading: { levels: [2, 3, 4] },
            },
      ),
      Link.configure({
        openOnClick: false,
        autolink: true,
        // rel and target are applied by the sanitiser on save, so pasted
        // links get them too — not just ones added through the toolbar.
        HTMLAttributes: { rel: "noopener nofollow", target: "_blank" },
      }),
      Image.configure({ inline: false }),
      /*
        Tables, so a comparison table survives editing. Without these the
        editor parsed an article with a table, dropped the nodes it did not
        know, and the next keystroke saved the article without it.
      */
      TableKit.configure({ table: { resizable: false } }),
      HeadingIds,
    ],
    content: value,
    // Next renders this on the server first; without it React reports a
    // hydration mismatch on every article page.
    immediatelyRender: false,
    editorProps: {
      /**
       * Intercept pasted and dropped images.
       *
       * Returning true tells Tiptap we handled it, so its default — inserting
       * the file as a data: URL — never runs. The upload is asynchronous and
       * the image appears when it lands; a placeholder would be nicer, and is
       * worth adding if anyone complains about the wait.
       */
      /**
       * Clicking an image opens the panel for it, so it can be changed or
       * removed. Without this an image was final once inserted: the only way
       * to replace one was to delete it by hand and start again.
       *
       * Not while editing is paused (editable={false}); the classic editor is
       * always editable, so this changes nothing there.
       */
      handleClickOn(view, pos, node, nodePos) {
        if (node.type.name !== "image" || !onUploadImage || !view.editable) return false;

        editingPosRef.current = nodePos;
        openPickerRef.current?.((node.attrs.src as string) ?? undefined, (node.attrs.alt as string | null) ?? null);
        return true;
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        const image = files.find((file) => file.type.startsWith("image/"));
        if (!image || !onUploadImage || !view.editable) return false;

        event.preventDefault();
        void insertUploaded(image);
        return true;
      },
      handleDrop(view, event) {
        const dropped = event as DragEvent;
        const files = Array.from(dropped.dataTransfer?.files ?? []);
        const image = files.find((file) => file.type.startsWith("image/"));
        if (!image || !onUploadImage || !view.editable) return false;

        dropped.preventDefault();
        void insertUploaded(image);
        return true;
      },
      /**
       * Explicit child selectors rather than `prose`:
       * @tailwindcss/typography is not installed, so the prose class is inert
       * here and headings would render at body size (CONTENT_CLASSES).
       */
      attributes: workspace
        ? {
            "aria-label": ariaLabel,
            role: "textbox",
            "aria-multiline": "true",
            ...(describedBy ? { "aria-describedby": describedBy } : {}),
            class: contentClassName ? `${CONTENT_CLASSES} ${contentClassName}` : CONTENT_CLASSES,
          }
        : compact
          ? {
              // A textbox among form fields, where a textarea used to be: named and announced as one.
              "aria-label": ariaLabel,
              role: "textbox",
              "aria-multiline": "true",
              class: COMPACT_CONTENT_CLASSES,
            }
          : {
              "aria-label": ariaLabel,
              class: CONTENT_CLASSES,
            },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  /**
   * Pull in content that changed underneath us — a rewrite finishing, or the
   * source textarea being edited. Guarded on inequality: writing the editor's
   * own output back would move the cursor to the start on every keystroke.
   */
  /**
   * The paste and drop handlers read the editor through this ref: they are
   * created once and would otherwise hold the first render's instance.
   *
   * In an effect rather than during render — writing a ref while rendering is
   * a side effect, and React may render twice without committing.
   */
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
      /*
        The compact editor's value changes underneath it only when the page
        loads, and a saved answer often differs from the editor's own HTML
        (the sanitiser writes a link's attributes in another order, and <br>
        as <br />), so loading it is a setContent. Kept out of undo history,
        or Undo was lit on an untouched answer and its first click "undid"
        the load into the same text. The full editor's sync stays undoable:
        there it can be a rewrite worth taking back.
      */
      if (compact) editor.chain().setMeta("addToHistory", false).setContent(value, { emitUpdate: false }).run();
      else editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value, compact]);

  /*
    Paused editing. Only ever called when the prop is false or changes back:
    the default (true) matches a new editor, so the classic editor is never
    touched. No update event, so pausing is not an edit.
  */
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) {
      editor.setEditable(editable, false);
    }
  }, [editor, editable]);

  if (!editor) {
    // Matches the editor's height so the card does not jump on mount.
    return (
      <div className={cn(compact ? "min-h-35" : "min-h-[30rem]", "rounded-md border border-input bg-muted/20")} />
    );
  }

  /* Workspace variant: the link dialog and the picker dialog. */
  function openLinkDialog() {
    if (!editor) return;
    linkReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusEditorOnCloseRef.current = false;
    const href = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLink((previous) => ({ open: true, initial: href, hasLink: editor.isActive("link"), key: previous.key + 1 }));
  }

  function closeLink() {
    setLink((previous) => ({ ...previous, open: false }));
  }

  /*
    The edits run without .focus() while the dialog still holds focus (its
    focus trap would fight the editor); the editor takes focus as the dialog
    closes, with the selection the command left.
  */
  function applyLink(href: string) {
    if (!editor) return;
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) {
      // Nothing selected: the address itself becomes the linked text.
      editor.chain().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      editor.chain().extendMarkRange("link").setLink({ href }).run();
    }
    focusEditorOnCloseRef.current = true;
    closeLink();
  }

  function removeLink() {
    if (!editor) return;
    editor.chain().extendMarkRange("link").unsetLink().run();
    focusEditorOnCloseRef.current = true;
    closeLink();
  }

  function returnFocus(event: Event, fallback: HTMLElement | null) {
    event.preventDefault();
    if (focusEditorOnCloseRef.current || !fallback || !fallback.isConnected) {
      editor?.commands.focus();
    } else {
      fallback.focus();
    }
    focusEditorOnCloseRef.current = false;
  }

  function insertFromPicker(url: string, altText: string) {
    if (!editor) return;
    const at = editingPosRef.current;
    // null drops the attribute rather than saving alt="" (see the classic picker below).
    const alt = altText || null;
    if (editingImage && at !== null) {
      editor
        .chain()
        .setNodeSelection(at)
        .updateAttributes("image", { src: url, alt, ...replacedSize(editingImage, url) })
        .run();
    } else {
      editor.chain().setImage({ src: url, alt: alt ?? undefined }).run();
    }
    recordImageSize(editor, url);
    editingPosRef.current = null;
    focusEditorOnCloseRef.current = true;
    setPickerOpen(false);
  }

  function removeFromPicker() {
    if (!editor) return;
    const at = editingPosRef.current;
    if (at !== null) editor.chain().setNodeSelection(at).deleteSelection().run();
    editingPosRef.current = null;
    focusEditorOnCloseRef.current = true;
    setPickerOpen(false);
  }

  return (
    <div>
      {workspace ? (
        <WorkspaceToolbar
          editor={editor}
          uploading={uploading}
          onInsertImage={onUploadImage ? openPickerAtCaret : undefined}
          onEditLink={openLinkDialog}
          disabled={!editable || showSource}
          t={t}
        />
      ) : compact ? (
        <CompactToolbar editor={editor} disabled={!editable} t={t} label={ariaLabel} />
      ) : (
        <Toolbar
          editor={editor}
          uploading={uploading}
          onInsertImage={
            onUploadImage ? openPickerAtCaret : undefined
          }
          t={t}
        />
      )}

      {workspace ? (
        <>
          <Dialog open={pickerOpen && Boolean(onUploadImage)} onOpenChange={(open) => (open ? undefined : setPickerOpen(false))}>
            <DialogContent
              showCloseButton={false}
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => returnFocus(event, pickerReturnRef.current)}
              className="top-4 max-h-[calc(100svh-2rem)] translate-y-0 overflow-y-auto bg-transparent p-0 ring-0 sm:top-16 sm:max-h-[calc(100svh-5rem)] sm:max-w-2xl motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
            >
              <DialogTitle className="sr-only">{t.chooseImage}</DialogTitle>
              {pickerOpen && onUploadImage ? (
                <ImagePicker
                  className="my-0"
                  images={pickerImages}
                  loading={pickerLoading}
                  selected={editingImage}
                  alt={editingAlt}
                  onSearch={loadImages}
                  onUpload={onUploadImage}
                  onInsert={insertFromPicker}
                  onRemove={editingImage ? removeFromPicker : undefined}
                  onClose={() => setPickerOpen(false)}
                  t={t}
                  tCommon={tCommon ?? getMessages("en").app.common}
                />
              ) : null}
            </DialogContent>
          </Dialog>
          <LinkDialog
            key={link.key}
            open={link.open}
            initial={link.initial}
            hasLink={link.hasLink}
            onApply={applyLink}
            onRemove={removeLink}
            onClose={closeLink}
            onCloseAutoFocus={(event) => returnFocus(event, linkReturnRef.current)}
            t={t}
            tCommon={tCommon ?? getMessages("en").app.common}
          />
        </>
      ) : pickerOpen && onUploadImage ? (
        /*
          Fixed to the viewport rather than absolutely placed over the text.
          Overlaying covered whatever it opened next to — clicking an image
          hid that image behind the panel, which read as the picture being
          deleted.

          Centred near the top of the screen, so it is always fully visible
          whatever part of a long article you were looking at, and the article
          stays readable behind it.
        */
        <>
          {/* Dimmed backdrop: makes it obvious the panel is a layer over the
              article, and gives a click target for dismissing it. */}
          <div
            className="fixed inset-0 z-40 bg-foreground/20"
            onClick={() => setPickerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.chooseImage}
            className="fixed left-1/2 top-16 z-50 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2"
          >
          <ImagePicker
            images={pickerImages}
            loading={pickerLoading}
            selected={editingImage}
            alt={editingAlt}
            onSearch={loadImages}
            onUpload={onUploadImage}
            onInsert={(url, altText) => {
              const at = editingPosRef.current;
              /*
                The description is always written, so a replaced picture never
                keeps the previous one's. null drops the attribute rather than
                saving alt="", which would tell search engines the image is
                decoration.
              */
              const alt = altText || null;

              /**
               * Replacing targets the clicked node by position rather than
               * "the current selection". handleClickOn returns true, which
               * stops Tiptap selecting the image, so there was no selection to
               * update and Replace quietly did nothing.
               */
              if (editingImage && at !== null) {
                editor
                  .chain()
                  .focus()
                  .setNodeSelection(at)
                  .updateAttributes("image", { src: url, alt, ...replacedSize(editingImage, url) })
                  .run();
              } else {
                editor.chain().focus().setImage({ src: url, alt: alt ?? undefined }).run();
              }
              recordImageSize(editor, url);

              editingPosRef.current = null;
              setPickerOpen(false);
            }}
            onRemove={
              editingImage
                ? () => {
                    const at = editingPosRef.current;
                    if (at !== null) {
                      // Select the node first, for the same reason as above.
                      editor
                        .chain()
                        .focus()
                        .setNodeSelection(at)
                        .deleteSelection()
                        .run();
                    }
                    editingPosRef.current = null;
                    setPickerOpen(false);
                  }
                : undefined
            }
            onClose={() => setPickerOpen(false)}
          />
          </div>
        </>
      ) : null}

      {showSource ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={20}
          aria-label={t.articleHtml}
          aria-describedby={workspace ? sourceHintId : undefined}
          readOnly={workspace && !editable ? true : undefined}
          className="flex w-full rounded-b-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="rounded-b-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        />
      )}

      {workspace ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p id={sourceHintId} className="min-w-0 text-xs text-muted-foreground">
            {showSource ? `${t.htmlHint} ${t.htmlToolbarOff}` : t.richHint}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={showSource}
            disabled={!editable}
            onClick={() => setShowSource((previous) => !previous)}
            className="h-7 text-xs"
          >
            {showSource ? t.backToEditor : t.editHtml}
          </Button>
        </div>
      ) : compact ? null : (
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
      )}
    </div>
  );
}
