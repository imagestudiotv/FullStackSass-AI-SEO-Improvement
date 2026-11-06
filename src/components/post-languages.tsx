"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { Locale } from "@/lib/i18n/config";

/**
 * Where the post on screen lives in each language, handed from the post's page
 * to the footer's language switcher (components/language-switcher.tsx).
 *
 * The footer belongs to the marketing layout, which is rendered without knowing
 * which post is showing (and must stay that way: reading the request there
 * would make every public page dynamic). So the page publishes its published
 * versions here once it is in the browser, and the switcher reads them. Until
 * then the switcher offers each language's blog, which is always true.
 *
 * `path` ties the versions to one post: during a client-side move to another
 * page, the versions of the post being left are not taken for the new page's.
 */
export type PostVersions = { path: string; versions: Partial<Record<Locale, string>> };

let current: PostVersions | null = null;
const listeners = new Set<() => void>();

function publish(next: PostVersions | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The versions of the post at `path`, or null while they are not known. */
export function usePostVersions(path: string): PostVersions["versions"] | null {
  const known = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return known?.path === path ? known.versions : null;
}

/** Rendered by a post's page; draws nothing. `versions`: the post's PUBLISHED languages, itself included. */
export function PublishPostVersions({ path, versions }: { path: string; versions: { locale: Locale; path: string }[] }) {
  const key = versions.map((version) => `${version.locale}:${version.path}`).join("|");
  useEffect(() => {
    const entries = key ? key.split("|").map((entry) => entry.split(":") as [Locale, string]) : [];
    const mine: PostVersions = { path, versions: Object.fromEntries(entries) };
    publish(mine);
    return () => {
      if (current === mine) publish(null);
    };
  }, [path, key]);
  return null;
}
