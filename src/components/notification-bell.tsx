"use client";

import { AlertTriangle, Bell, Check, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listNotifications,
  markAllRead,
  markRead,
} from "@/lib/notifications/actions";
import type { NotificationView } from "@/lib/notifications/shared";

/**
 * Notification bell.
 *
 * Background jobs take minutes, and until now the only signal was a toast that
 * exists while the tab is open. Someone who started an article and closed the
 * tab never learned it finished — or, worse, never learned it failed.
 *
 * Loads on open rather than polling. A poll would mean a request every few
 * seconds from every open tab for events that arrive a few times a day; the
 * count rendered on the server is accurate as of page load, which for
 * minutes-long jobs is the right granularity.
 */
export function NotificationBell({
  initialUnread,
}: {
  initialUnread: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleOpenChange(open: boolean) {
    if (!open) return;
    setLoading(true);
    try {
      const result = await listNotifications();
      setItems(result.items);
      setUnread(result.unread);
    } catch {
      // Leaves the list null, which renders as the empty state below rather
      // than an error the customer can do nothing about.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllRead();
      setUnread(0);
      setItems((prev) =>
        prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })) : prev,
      );
      router.refresh();
    });
  }

  function handleClick(item: NotificationView) {
    if (!item.readAt) {
      setUnread((n) => Math.max(0, n - 1));
      // Not awaited: the navigation should not wait on bookkeeping.
      void markRead(item.id);
    }
    if (item.href) router.push(item.href);
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium tabular-nums text-primary-foreground"
              aria-hidden="true"
            >
              {/* Past nine the exact number stops mattering and starts wrapping. */}
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <CheckCheck className="size-3" aria-hidden="true" />
              Mark all read
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : !items || items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. We will tell you here when your articles and audits are
            ready.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((item) => {
              const failed = item.type.endsWith(".failed");
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(item)}
                    className="flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="mt-0.5 shrink-0">
                      {failed ? (
                        <AlertTriangle
                          className="size-4 text-destructive"
                          aria-hidden="true"
                        />
                      ) : (
                        <Check
                          className="size-4 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm ${item.readAt ? "text-muted-foreground" : "font-medium"}`}
                      >
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.body}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-muted-foreground/80">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </span>
                    {!item.readAt ? (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
