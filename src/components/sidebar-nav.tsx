"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        if (item.disabled) {
          return (
            <span
              key={item.title}
              aria-disabled="true"
              // Shown but not clickable: the feature is coming, and hiding it
              // entirely would make the product look less capable than it is.
              className="flex cursor-not-allowed select-none items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/40"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.title}
            </span>
          );
        }

        return (
          <Link
            key={item.title}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
