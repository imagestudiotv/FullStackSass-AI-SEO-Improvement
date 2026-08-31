"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Search box that writes the query into the URL.
 *
 * Kept in the URL rather than component state so an admin can bookmark or
 * share a filtered view, and so a page refresh does not lose it.
 */
export function AdminSearch({
  placeholder,
  defaultValue = "",
  extraParams = {},
}: {
  placeholder: string;
  defaultValue?: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    for (const [key, entry] of Object.entries(extraParams)) {
      next.set(key, entry);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex max-w-md gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <Button type="submit" variant="outline">
        <Search className="size-4" />
        Search
      </Button>
    </form>
  );
}
