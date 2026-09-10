"use client";

import { ImageIcon, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  regenerateArticleImage,
  removeArticleImage,
  updateArticleImageAlt,
  uploadArticleImage,
} from "@/lib/articles/image-actions";

/**
 * The article's picture, and the three things you can do to it.
 *
 * The image was decided by the job that wrote the article and could not be
 * changed: the first time anyone saw it was on their own website. This panel
 * is the answer to "not that one" — describe a different picture, upload your
 * own, or have none.
 *
 * Regeneration is capped, and the remaining count is shown rather than
 * discovered by hitting a wall. Each attempt costs real money, and a button
 * that stops working without warning reads as a bug.
 */

const MAX_ATTEMPTS = 5;

export function FeaturedImage({
  websiteId,
  articleId,
  imageUrl,
  imageAlt,
  attempts,
}: {
  websiteId: string;
  articleId: string;
  imageUrl: string | null;
  imageAlt: string | null;
  attempts: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [alt, setAlt] = useState(imageAlt ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(MAX_ATTEMPTS - attempts, 0);

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateArticleImage(websiteId, articleId, prompt);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPrompt("");
      toast.success("New image ready");
      router.refresh();
    });
  }

  function upload(file: File) {
    const body = new FormData();
    body.set("file", file);

    startTransition(async () => {
      const result = await uploadArticleImage(websiteId, articleId, body);
      // Cleared either way, or picking the same file twice does nothing the
      // second time — the input fires no change event for an unchanged value.
      if (fileRef.current) fileRef.current.value = "";

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Image uploaded");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeArticleImage(websiteId, articleId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Image removed");
      router.refresh();
    });
  }

  function saveAlt() {
    if (alt === (imageAlt ?? "")) return;
    startTransition(async () => {
      const result = await updateArticleImageAlt(websiteId, articleId, alt);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Featured image
          {pending ? (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
        </CardTitle>
        <CardDescription>
          The picture at the top of the article, and the one shown when it is
          shared.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {imageUrl ? (
          /*
            A plain <img>: once published, this file lives on the customer's
            own CMS, so next/image would need every customer domain listed in
            remotePatterns.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt ?? ""}
            className="aspect-video w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed bg-muted/30">
            <div className="text-center">
              <ImageIcon
                className="mx-auto size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                No image yet
              </p>
            </div>
          </div>
        )}

        {imageUrl ? (
          <div className="space-y-1.5">
            <Label htmlFor="image-alt">Image description</Label>
            <Input
              id="image-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              onBlur={saveAlt}
              placeholder="What the picture shows"
            />
            <p className="text-xs text-muted-foreground">
              Read aloud to people using a screen reader, and by search
              engines.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="image-prompt">Describe a different picture</Label>
          <textarea
            id="image-prompt"
            rows={2}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="An evening ceremony lit by candles, no people in shot"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">
            {remaining > 0
              ? `Leave empty and we will choose. ${remaining} of ${MAX_ATTEMPTS} left.`
              : "You have used all the regenerations for this article. Upload your own picture instead."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || remaining === 0}
            onClick={regenerate}
          >
            <Sparkles className="size-4" />
            {imageUrl ? "Replace" : "Generate"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            Upload
          </Button>

          {imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={remove}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : null}

          {/*
            Hidden but real: a styled button opens it, and the file input
            itself stays in the form so the browser handles picking a file.
          */}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
