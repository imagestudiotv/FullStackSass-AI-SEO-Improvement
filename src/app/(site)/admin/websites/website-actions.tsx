"use client";

import { Building2, CreditCard, ExternalLink, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DeleteWebsiteDialog } from "./delete-website";

/**
 * The row menu for one website: the related views first, deletion last and
 * apart, so the destructive item is never the one under the pointer by habit.
 */
export function WebsiteActions({
  websiteId,
  domain,
  url,
  articleCount,
  organizationId,
  organizationName,
}: {
  websiteId: string;
  domain: string;
  url: string;
  articleCount: number;
  organizationId: string;
  organizationName: string | null;
}) {
  const [deleting, setDeleting] = useState(false);
  // Only a web address opens: the value is customer-entered.
  const external = /^https?:\/\//i.test(url) ? url : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${domain}`}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Go to</DropdownMenuLabel>
          {external ? (
            <DropdownMenuItem asChild>
              <a href={external} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Open the site
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            {/* Articles has no website filter: the workspace filter plus the domain as the search. */}
            <Link href={`/admin/articles?org=${encodeURIComponent(organizationId)}&q=${encodeURIComponent(domain)}`}>
              <FileText aria-hidden="true" />
              Articles
              <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground">{articleCount}</span>
            </Link>
          </DropdownMenuItem>
          {organizationName ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/organizations?q=${encodeURIComponent(organizationName)}`}>
                <Building2 aria-hidden="true" />
                Workspace
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/admin/payments?org=${encodeURIComponent(organizationId)}`}>
              <CreditCard aria-hidden="true" />
              Workspace payments
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" />
            Delete website…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteWebsiteDialog
        websiteId={websiteId}
        domain={domain}
        articleCount={articleCount}
        organizationId={organizationId}
        organizationName={organizationName}
        open={deleting}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
