"use client";

import { ExternalLink, FileText, Globe, MoreHorizontal, SearchCheck, Building2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The trailing "More" menu of a Partner Network row: the related records an
 * operator may want next (the review, the article, the website, the
 * workspace). Links only - nothing here changes anything.
 *
 * Icons are named rather than passed, because a server page renders this and
 * a component cannot cross into a client prop.
 */

const ICONS = {
  review: SearchCheck,
  article: FileText,
  website: Globe,
  workspace: Building2,
  external: ExternalLink,
} as const;

export type RowLink = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Opens in a new tab (a page on a customer's site). */
  external?: boolean;
};

export function RowLinksMenu({ label, links }: { label: string; links: RowLink[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {links.map((link) => {
          const Icon = ICONS[link.icon];
          return (
            <DropdownMenuItem key={`${link.icon}:${link.href}`} asChild>
              {link.external ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  <Icon aria-hidden="true" />
                  {link.label}
                </a>
              ) : (
                <Link href={link.href}>
                  <Icon aria-hidden="true" />
                  {link.label}
                </Link>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
