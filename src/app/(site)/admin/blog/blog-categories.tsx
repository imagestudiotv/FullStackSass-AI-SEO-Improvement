"use client";

import { ExternalLink, FolderOpen, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createBlogCategory,
  deleteBlogCategory,
  saveBlogCategory,
  type AdminBlogCategory,
} from "@/lib/admin/blog";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { blogSlug } from "@/lib/blog/shared";
import { LOCALES } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";

import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { useUnsavedChanges } from "../_ui/use-unsaved-changes";
import { ConfirmDialog } from "./confirm-dialog";

/** Shown when a server action throws instead of answering (expired session, database error). */
const UNEXPECTED = "The server did not finish this - try again. If it keeps failing, check the server logs.";

const postsLabel = (count: number) => `${formatNumber(count, "en")} ${count === 1 ? "post" : "posts"}`;

type Translations = AdminBlogCategory["translations"];

/** The blog's languages other than English, in which a category has a name of its own. */
const OTHER_LOCALES = LOCALES.filter((locale): locale is keyof Translations => locale !== "en");

/** Two sets of translations the same once blanks are ignored (a blank shows the English either way). */
function sameTranslations(a: Translations, b: Translations): boolean {
  return OTHER_LOCALES.every(
    (locale) =>
      (a[locale]?.name ?? "").trim() === (b[locale]?.name ?? "").trim() &&
      (a[locale]?.blurb ?? "").trim() === (b[locale]?.blurb ?? "").trim(),
  );
}

/**
 * The blog's categories: add one, rename it or change its description, and
 * delete one no post uses (client, 2026-10-01). A new category's page
 * (/blog/category/<address>) exists at once; it appears on the blog's index
 * as soon as a published post is in it.
 *
 * Each also has a name and description per language (client, 2026-10-15),
 * shown on that language's blog (/it/blog, /it/blog/category/<address>); a
 * language left blank shows the English ones.
 */
export function BlogCategories({ categories }: { categories: AdminBlogCategory[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [translations, setTranslations] = useState<Translations>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editDirty, setEditDirty] = useState(false);

  // A half-typed new category or an open rename is lost by leaving: ask first.
  useUnsavedChanges(Boolean(name.trim() || blurb.trim()) || !sameTranslations(translations, {}) || editDirty);

  function stopEditing() {
    setEditing(null);
    setEditDirty(false);
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      try {
        const result = await createBlogCategory({ name, blurb, translations });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Added "${result.data.name}"`);
        setName("");
        setBlurb("");
        setTranslations({});
        router.refresh();
      } catch (error) {
        console.error("[admin/blog] adding a category failed", error);
        toast.error(UNEXPECTED);
      }
    });
  }

  const newSlug = name.trim() ? blogSlug(name) : "";

  return (
    <AdminTableCard
      footer={
        <form onSubmit={add} aria-labelledby="new-category-title" className="space-y-3 py-1">
          <h3 id="new-category-title" className="text-sm font-semibold">
            Add a category
          </h3>
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
                className="bg-background"
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
                className="bg-background"
              />
            </div>
          </div>
          {/* Optional now, and editable later: closed so the form stays two fields long. */}
          <details className="rounded-lg border bg-background/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">In other languages (optional)</summary>
            <div className="mt-3 space-y-3">
              <TranslationFields
                idPrefix="new-category"
                slug={newSlug}
                translations={translations}
                englishName={name}
                englishBlurb={blurb}
                disabled={pending}
                onChange={setTranslations}
              />
            </div>
          </details>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground wrap-anywhere" aria-live="polite">
              {newSlug
                ? `Its page: /blog/category/${newSlug} - this address does not change later, even if you rename it.`
                : "Its page's address is made from the name and does not change later."}
            </p>
            <Button type="submit" disabled={pending || !name.trim()} className="self-start sm:self-auto">
              {pending ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Add category
            </Button>
          </div>
        </form>
      }
    >
      {categories.length === 0 ? (
        <AdminEmpty
          filtering={false}
          icon={FolderOpen}
          noun="categories"
          title="No categories yet"
          description="Add the first one below. A post needs a category before it can be saved."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead data-numeric className="w-16">
                Posts
              </TableHead>
              <TableHead className="hidden md:table-cell">Page</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) =>
              editing === category.id ? (
                <TableRow key={category.id} className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={4} className="whitespace-normal">
                    <EditCategory category={category} onDone={stopEditing} onDirtyChange={setEditDirty} />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={category.id}>
                  <TableCell className="min-w-36 whitespace-normal sm:min-w-48">
                    <p className="font-medium wrap-anywhere">{category.name}</p>
                    {category.blurb ? <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">{category.blurb}</p> : null}
                    <TranslationSummary translations={category.translations} />
                    <div className="mt-1 md:hidden">
                      <CategoryPageLink slug={category.slug} />
                    </div>
                  </TableCell>
                  <TableCell data-numeric>
                    {formatNumber(category.posts, "en")}
                    <span className="sr-only"> {category.posts === 1 ? "post" : "posts"}, drafts included</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <CategoryPageLink slug={category.slug} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(category.id);
                          setEditDirty(false);
                        }}
                        aria-label={`Edit ${category.name}`}
                      >
                        <Pencil aria-hidden="true" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <CategoryActions category={category} />
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      )}
    </AdminTableCard>
  );
}

function CategoryPageLink({ slug }: { slug: string }) {
  return (
    <a
      href={`/blog/category/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="relative inline-flex max-w-full items-center gap-1 rounded-sm font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Wraps rather than truncates: the whole address stays readable, and the column can narrow on a phone. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">/blog/category/{slug}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/**
 * A category's names in the other languages, in one line under its English
 * one: what each language's blog shows. A dash is a language still showing
 * the English name.
 */
function TranslationSummary({ translations }: { translations: Translations }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {OTHER_LOCALES.map((locale) => {
        const name = translations[locale]?.name?.trim();
        return (
          <span key={locale} className="wrap-anywhere">
            <abbr title={LANGUAGE_NAMES_EN[locale]} className="font-medium no-underline">
              {locale.toUpperCase()}
            </abbr>{" "}
            {name ? (
              <span lang={locale}>{name}</span>
            ) : (
              <>
                <span aria-hidden="true">-</span>
                <span className="sr-only">not translated, shows the English name</span>
              </>
            )}
          </span>
        );
      })}
    </p>
  );
}

/**
 * A category's name and description in each of the other languages, for the
 * Add and Edit forms. The English ones show as placeholders: what that
 * language's blog shows while its field is left blank.
 */
function TranslationFields({
  idPrefix,
  slug,
  translations,
  englishName,
  englishBlurb,
  disabled,
  onChange,
}: {
  idPrefix: string;
  /** The category's address, for the example; empty while a new one has no name. */
  slug: string;
  translations: Translations;
  englishName: string;
  englishBlurb: string;
  disabled: boolean;
  onChange: (next: Translations) => void;
}) {
  function set(locale: keyof Translations, field: "name" | "blurb", value: string) {
    const current = translations[locale] ?? { name: "", blurb: "" };
    onChange({ ...translations, [locale]: { ...current, [field]: value } });
  }
  return (
    <>
      <p className="text-xs text-muted-foreground wrap-anywhere">
        Shown on that language&apos;s blog{slug ? `, for example /it/blog/category/${slug}` : ""}. Left blank, it shows the
        English name and description.
      </p>
      {OTHER_LOCALES.map((locale) => (
        <div key={locale} className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-name-${locale}`}>{LANGUAGE_NAMES_EN[locale]} name</Label>
            <Input
              id={`${idPrefix}-name-${locale}`}
              lang={locale}
              value={translations[locale]?.name ?? ""}
              maxLength={40}
              placeholder={englishName}
              onChange={(event) => set(locale, "name", event.target.value)}
              disabled={disabled}
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-blurb-${locale}`}>{LANGUAGE_NAMES_EN[locale]} description</Label>
            <Input
              id={`${idPrefix}-blurb-${locale}`}
              lang={locale}
              value={translations[locale]?.blurb ?? ""}
              maxLength={200}
              placeholder={englishBlurb}
              onChange={(event) => set(locale, "blurb", event.target.value)}
              disabled={disabled}
              className="bg-background"
            />
          </div>
        </div>
      ))}
    </>
  );
}

function EditCategory({
  category,
  onDone,
  onDirtyChange,
}: {
  category: AdminBlogCategory;
  onDone: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(category.name);
  const [blurb, setBlurb] = useState(category.blurb);
  const [translations, setTranslations] = useState<Translations>(category.translations);

  function change(nextName: string, nextBlurb: string, nextTranslations: Translations = translations) {
    setName(nextName);
    setBlurb(nextBlurb);
    setTranslations(nextTranslations);
    onDirtyChange(
      nextName !== category.name || nextBlurb !== category.blurb || !sameTranslations(nextTranslations, category.translations),
    );
  }

  return (
    <form
      className="space-y-3 py-1"
      aria-label={`Edit the category ${category.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const result = await saveBlogCategory({ id: category.id, name, blurb, translations });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(name.trim() !== category.name ? `Renamed - its posts moved with it` : "Saved");
            onDone();
            router.refresh();
          } catch (error) {
            console.error("[admin/blog] saving a category failed", error);
            toast.error(UNEXPECTED);
          }
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
            onChange={(event) => change(event.target.value, blurb)}
            disabled={pending}
            className="bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`category-blurb-${category.id}`}>Description</Label>
          <Input
            id={`category-blurb-${category.id}`}
            value={blurb}
            maxLength={200}
            onChange={(event) => change(name, event.target.value)}
            disabled={pending}
            className="bg-background"
          />
        </div>
      </div>
      <fieldset className="space-y-3 rounded-lg border bg-background/60 p-3">
        <legend className="px-1 text-sm font-semibold">In other languages</legend>
        <TranslationFields
          idPrefix={`category-${category.id}`}
          slug={category.slug}
          translations={translations}
          englishName={name}
          englishBlurb={blurb}
          disabled={pending}
          onChange={(next) => change(name, blurb, next)}
        />
      </fieldset>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground wrap-anywhere">
          The address stays /blog/category/{category.slug}.
          {category.posts > 0 ? ` Renaming it renames it on its ${postsLabel(category.posts)}.` : ""}
        </p>
        <div className="flex gap-2 self-end sm:self-auto">
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * The row's less common actions, delete among them, behind one menu so it
 * never sits beside Edit as an equal button. A category still in use cannot
 * be deleted, and the menu says why in words - the old disabled button only
 * had a tooltip, which a disabled button never shows.
 */
function CategoryActions({ category }: { category: AdminBlogCategory }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const inUse = category.posts > 0;

  function remove() {
    start(async () => {
      try {
        const result = await deleteBlogCategory({ id: category.id });
        if (!result.ok) {
          toast.error(result.error);
          setConfirming(false);
          return;
        }
        toast.success(`Deleted "${category.name}"`);
        setConfirming(false);
        router.refresh();
      } catch (error) {
        console.error("[admin/blog] deleting a category failed", error);
        toast.error(UNEXPECTED);
        setConfirming(false);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${category.name}`} disabled={pending}>
            {pending ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <MoreHorizontal aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem asChild>
            <a href={`/blog/category/${category.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Open its page
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={inUse} onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" />
            Delete category
          </DropdownMenuItem>
          {inUse ? (
            <p className="px-1.5 pb-1.5 text-xs text-muted-foreground">
              In use by {postsLabel(category.posts)} (drafts included). Move them to another category first.
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete the category "${category.name}"?`}
        description={`Its page /blog/category/${category.slug}, and the same page on each language's blog (/it/blog/category/${category.slug} and the others), will stop existing. This cannot be undone.`}
        confirmLabel="Delete category"
        tone="danger"
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
