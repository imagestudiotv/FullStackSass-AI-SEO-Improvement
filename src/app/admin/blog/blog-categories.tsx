"use client";

import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBlogCategory,
  deleteBlogCategory,
  saveBlogCategory,
  type AdminBlogCategory,
} from "@/lib/admin/blog";
import { blogSlug } from "@/lib/blog/shared";

/**
 * The blog's categories: add one, rename it or change its description, and
 * delete one no post uses (client, 2026-10-01). A new category's page
 * (/blog/category/<address>) exists at once; it appears on the blog's index
 * as soon as a published post is in it.
 */
export function BlogCategories({ categories }: { categories: AdminBlogCategory[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  function add(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await createBlogCategory({ name, blurb });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added "${result.data.name}"`);
      setName("");
      setBlurb("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-lg border">
        {categories.map((category) =>
          editing === category.id ? (
            <li key={category.id} className="p-3">
              <EditCategory category={category} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={category.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {category.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {category.posts} post{category.posts === 1 ? "" : "s"}
                  </span>
                </p>
                <a
                  href={`/blog/category/${category.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  /blog/category/{category.slug}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                {category.blurb ? <p className="mt-1 text-xs text-muted-foreground">{category.blurb}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(category.id)}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Edit
                </Button>
                <DeleteCategory category={category} />
              </div>
            </li>
          ),
        )}
      </ul>

      <form onSubmit={add} className="space-y-3 rounded-lg border border-dashed p-3">
        <p className="text-sm font-medium">Add a category</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="new-category-name">Name</Label>
            <Input
              id="new-category-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Case studies"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-category-blurb">Description</Label>
            <Input
              id="new-category-blurb"
              value={blurb}
              maxLength={200}
              onChange={(event) => setBlurb(event.target.value)}
              placeholder="One line shown under the category's heading"
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {name.trim() && blogSlug(name)
              ? `Its page: /blog/category/${blogSlug(name)} - this address does not change later, even if you rename it.`
              : "Its page's address is made from the name and does not change later."}
          </p>
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Add category
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditCategory({ category, onDone }: { category: AdminBlogCategory; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(category.name);
  const [blurb, setBlurb] = useState(category.blurb);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await saveBlogCategory({ id: category.id, name, blurb });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(name.trim() !== category.name ? `Renamed - its posts moved with it` : "Saved");
          onDone();
          router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor={`category-name-${category.id}`}>Name</Label>
          <Input
            id={`category-name-${category.id}`}
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`category-blurb-${category.id}`}>Description</Label>
          <Input
            id={`category-blurb-${category.id}`}
            value={blurb}
            maxLength={200}
            onChange={(event) => setBlurb(event.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          The address stays /blog/category/{category.slug}.
          {category.posts > 0 ? ` Renaming it renames it on its ${category.posts} post${category.posts === 1 ? "" : "s"}.` : ""}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}

function DeleteCategory({ category }: { category: AdminBlogCategory }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inUse = category.posts > 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending || inUse}
      title={inUse ? "Move its posts to another category first" : undefined}
      onClick={() => {
        if (!window.confirm(`Delete the category "${category.name}"? Its page /blog/category/${category.slug} will stop existing.`)) return;
        start(async () => {
          const result = await deleteBlogCategory({ id: category.id });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Deleted "${category.name}"`);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
      Delete
    </Button>
  );
}
