"use client";

import {
  BarChart3,
  Building2,
  FileText,
  Receipt,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Admin section navigation.
 *
 * A client component only so it can light the current section. The header had
 * no active state at all, so an operator six pages into a refund had nothing
 * on screen saying which list they were looking at — the one thing a nav is
 * for.
 */

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/activity", label: "Activity", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto"
      aria-label="Admin sections"
    >
      {NAV.map((item) => {
        /**
         * Overview is the section root, so it must match exactly — every
         * other path starts with it and would keep it permanently lit.
         */
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
