"use client";

import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadBlogImage } from "@/lib/admin/blog";
import { deleteBlogImage } from "@/lib/admin/blog-images";
import { BLOG_LOCALES, isBlogLocale, LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";

import { ConfirmDialog } from "../confirm-dialog";

/** Copy the picture's address; delete it when no post uses it, after a confirmation. */
export function ImageCardActions({ url, inUse }: { url: string; inUse: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Address copied");
    } catch {
      toast.error("Could not copy. Open the picture and copy its address from the browser.");
    }
  }

  function remove() {
    start(async () => {
      const result = await deleteBlogImage(url).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      setConfirming(false);
      if (!result.ok) toast.error(result.error);
      else toast.success("Picture deleted");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        <Copy aria-hidden="true" />
        Copy address
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(true)}
        disabled={pending || inUse}
        title={inUse ? "Used in a post - remove it from the post first" : undefined}
      >
        <Trash2 aria-hidden="true" />
        Delete
      </Button>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? null : setConfirming(false))}
          title="Delete this picture?"
          description="It is removed from storage for good. No saved post uses it; a post you are editing right now and have not saved yet could still be showing it."
          confirmLabel="Delete picture"
          tone="danger"
          pending={pending}
          onConfirm={remove}
        />
      ) : null}
    </div>
  );
}

/**
 * Uploads a picture to the blog, as one of a language's pictures: the post
 * editor suggests a post the pictures in its language (lib/admin/blog-images.ts).
 * The language starts as the one the page shows. On "All languages" there is
 * none until one is chosen: a default would file pictures under it unnoticed,
 * and an Italian picture filed as English is suggested to English posts.
 */
export function UploadBlogImage({ language: shown }: { language: Locale | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<Locale | null>(shown);

  function upload(file: File) {
    const chosen = language;
    if (!chosen) return;
    start(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("locale", chosen);
      const result = await uploadBlogImage(form).catch(() => null);
      if (!result) {
        toast.error("The picture could not be uploaded. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${LANGUAGE_NAMES_EN[chosen]} picture uploaded`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="blog-image-language" className="text-sm text-muted-foreground">
        Upload as
      </label>
      <select
        id="blog-image-language"
        value={language ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          setLanguage(isBlogLocale(value) ? value : null);
        }}
        disabled={pending}
        className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {language ? null : (
          <option value="" disabled>
            Choose a language
          </option>
        )}
        {BLOG_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LANGUAGE_NAMES_EN[locale]}
          </option>
        ))}
      </select>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload(file);
        }}
      />
      <Button
        type="button"
        size="lg"
        onClick={() => input.current?.click()}
        disabled={pending || !language}
        title={language ? undefined : "Choose the picture's language first"}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        Upload picture
      </Button>
    </div>
  );
}
