"use client";

import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadBlogImage } from "@/lib/admin/blog";
import { deleteBlogImage } from "@/lib/admin/blog-images";

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

/** Uploads a picture to the blog's folder, ready to use in any post. */
export function UploadBlogImage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function upload(file: File) {
    start(async () => {
      const form = new FormData();
      form.set("file", file);
      const result = await uploadBlogImage(form).catch(() => null);
      if (!result) {
        toast.error("The picture could not be uploaded. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Picture uploaded");
      router.refresh();
    });
  }

  return (
    <>
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
      <Button type="button" size="lg" onClick={() => input.current?.click()} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        Upload picture
      </Button>
    </>
  );
}
