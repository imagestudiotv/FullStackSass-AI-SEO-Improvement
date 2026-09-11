"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ImagePicker, type PickerImage } from "@/components/image-picker";
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

function Toolbar({
  editor,
  onInsertImage,
  uploading,
}: {
  editor: Editor;
  /** Opens the file picker. Absent when the page cannot store images. */
  onInsertImage?: () => void;
  uploading: boolean;
}) {
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

      {onInsertImage ? (
        <>
          <ToolbarButton
            label="Insert image"
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
  onUploadImage,
  onListImages,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
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
  const openPickerRef = useRef<((replacing?: string) => void) | null>(null);

  const insertUploaded = useCallback(
    async (file: File) => {
      if (!onUploadImage) return;

      setUploading(true);
      try {
        const url = await onUploadImage(file);
        if (url) {
          editorRef.current?.chain().focus().setImage({ src: url }).run();
        }
      } finally {
        setUploading(false);
      }
    },
    [onUploadImage],
  );

  /**
   * Opens the panel beside whatever the customer is pointing at.
   *
   * The offset is measured from the editor's own box rather than the viewport,
   * because the panel is absolutely positioned inside it — a viewport
   * coordinate would drift as soon as the page scrolled.
   */
  const openPicker = useCallback((replacing?: string) => {
    setEditingImage(replacing ?? null);
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    openPickerRef.current = openPicker;
  }, [openPicker]);

  /** Opens at the caret, for the toolbar button. */
  const openPickerAtCaret = useCallback(() => openPicker(), [openPicker]);

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
       */
      handleClickOn(view, pos, node, nodePos) {
        if (node.type.name !== "image" || !onUploadImage) return false;

        editingPosRef.current = nodePos;
        openPickerRef.current?.((node.attrs.src as string) ?? undefined);
        return true;
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        const image = files.find((file) => file.type.startsWith("image/"));
        if (!image || !onUploadImage) return false;

        event.preventDefault();
        void insertUploaded(image);
        return true;
      },
      handleDrop(view, event) {
        const dropped = event as DragEvent;
        const files = Array.from(dropped.dataTransfer?.files ?? []);
        const image = files.find((file) => file.type.startsWith("image/"));
        if (!image || !onUploadImage) return false;

        dropped.preventDefault();
        void insertUploaded(image);
        return true;
      },
      attributes: {
        "aria-label": ariaLabel,
        /**
         * Explicit child selectors rather than `prose`:
         * @tailwindcss/typography is not installed, so the prose class is inert
         * here and headings would render at body size. This mirrors how the
         * preview tab styles the same HTML, so the two views agree.
         */
        class:
          "min-h-[28rem] px-3 py-2 text-sm focus:outline-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_img]:my-6 [&_img]:block [&_img]:mx-auto [&_img]:max-w-xl [&_img]:max-h-[30rem] [&_img]:h-auto [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:object-contain",
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
      <Toolbar
        editor={editor}
        uploading={uploading}
        onInsertImage={
          onUploadImage ? openPickerAtCaret : undefined
        }
      />

      {pickerOpen && onUploadImage ? (
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
            aria-label="Choose an image"
            className="fixed left-1/2 top-16 z-50 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2"
          >
          <ImagePicker
            images={pickerImages}
            loading={pickerLoading}
            selected={editingImage}
            onSearch={loadImages}
            onUpload={onUploadImage}
            onInsert={(url) => {
              const at = editingPosRef.current;

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
                  .updateAttributes("image", { src: url })
                  .run();
              } else {
                editor.chain().focus().setImage({ src: url }).run();
              }

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
