"use client";

import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ImagePicker, type PickerImage, type PickerScopes } from "@/components/image-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listBlogImagesForPicker } from "@/lib/admin/blog-images";
import { BUSINESS_LIMITS, businessInitial, businessWebsite, type BlogBusiness } from "@/lib/blog/business";

/**
 * The post's "Business" section (client, 2026-11-11): the business a
 * customer story is about - its logo (one of the blog's pictures, uploaded
 * or chosen from the library exactly like the featured image), name,
 * category, website and a one-line tagline. Shown on the homepage's
 * Customer stories and in Earn Credits' "Discover businesses" when the post
 * is in the Customer stories category. All optional; saved with the post.
 */
export function BusinessField({
  value,
  scopes,
  onChange,
  onUpload,
}: {
  value: BlogBusiness;
  /** The picture library's language choice, as the featured image's. */
  scopes: PickerScopes;
  onChange: (business: BlogBusiness) => void;
  /** Stores a file and returns its address, or null after saying why not. */
  onUpload: (file: File) => Promise<string | null>;
}) {
  const [picking, setPicking] = useState(false);
  const [images, setImages] = useState<PickerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = useRef(0);
  const set = <K extends keyof BlogBusiness>(key: K, next: BlogBusiness[K]) => onChange({ ...value, [key]: next });
  const websiteInvalid = value.websiteUrl.trim() !== "" && businessWebsite(value.websiteUrl) === null;

  async function search(term: string, scope?: string) {
    const request = ++latest.current;
    setLoading(true);
    try {
      const found = await listBlogImagesForPicker(term, scope);
      if (request === latest.current) setImages(found);
    } catch (error) {
      console.error("[admin/blog] listing pictures failed", error);
      if (request === latest.current) toast.error("The pictures could not be listed. Try again.");
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const url = await onUpload(file);
      if (url) set("logoUrl", url);
    } finally {
      setUploading(false);
    }
  }

  if (picking) {
    return (
      <ImagePicker
        className="my-0"
        images={images}
        loading={loading}
        selected={value.logoUrl || null}
        alt={null}
        scopes={scopes}
        onSearch={search}
        onUpload={onUpload}
        onInsert={(url) => {
          set("logoUrl", url);
          setPicking(false);
        }}
        onRemove={
          value.logoUrl
            ? () => {
                set("logoUrl", "");
                setPicking(false);
              }
            : undefined
        }
        onClose={() => setPicking(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* As the homepage shows it: a small square tile, the logo fitted inside; the name's initial without one. */}
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border bg-white">
          {value.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.logoUrl} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-xl font-semibold text-neutral-700" aria-hidden="true">
              {businessInitial(value.name)}
            </span>
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70" role="status">
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span className="sr-only">Uploading…</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {value.logoUrl ? "Upload a new logo" : "Upload logo"}
          </Button>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => setPicking(true)}>
            <ImageIcon aria-hidden="true" />
            {value.logoUrl ? "Replace from library" : "Choose from library"}
          </Button>
          {value.logoUrl ? (
            <Button type="button" variant="ghost" disabled={uploading} onClick={() => set("logoUrl", "")} className="text-muted-foreground hover:text-danger">
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A small square picture (the business&apos;s logo or favicon), PNG, JPEG or WebP. Without one, a tile with the name&apos;s first letter is shown.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="blog-business-name" label="Business name" hint="Shown as “Name · Customer story”. Empty: the post's author.">
          <Input id="blog-business-name" value={value.name} maxLength={BUSINESS_LIMITS.name} onChange={(e) => set("name", e.target.value)} aria-describedby="blog-business-name-hint" />
        </Field>
        <Field id="blog-business-category" label="Business category" hint="A short label, e.g. Photography & Film.">
          <Input
            id="blog-business-category"
            value={value.category}
            maxLength={BUSINESS_LIMITS.category}
            onChange={(e) => set("category", e.target.value)}
            aria-describedby="blog-business-category-hint"
          />
        </Field>
      </div>
      <Field
        id="blog-business-website"
        label="Website"
        hint={websiteInvalid ? <span className="text-danger">Use a full web address starting with https:// (or http://).</span> : "The business's own site, starting with https://."}
      >
        <Input
          id="blog-business-website"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={value.websiteUrl}
          maxLength={BUSINESS_LIMITS.websiteUrl}
          aria-invalid={websiteInvalid || undefined}
          onChange={(e) => set("websiteUrl", e.target.value)}
          aria-describedby="blog-business-website-hint"
        />
      </Field>
      <Field id="blog-business-tagline" label="Tagline" hint="One short line under the name in Discover businesses. Empty: the post's description.">
        <Input
          id="blog-business-tagline"
          value={value.tagline}
          maxLength={BUSINESS_LIMITS.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          aria-describedby="blog-business-tagline-hint"
        />
      </Field>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
