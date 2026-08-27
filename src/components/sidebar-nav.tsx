"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        if (item.disabled) {
          return (
            <span
              key={item.title}
              aria-disabled="true"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
            >
              <Icon className="size-4 shrink-0" />
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
                ? "bg-accent text-accent-foreground font-medium"
                : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
