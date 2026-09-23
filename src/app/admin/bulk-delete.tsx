"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteManyOrganizations,
  deleteManyUsers,
  deleteManyWebsites,
} from "@/lib/admin/operations";

/**
 * Selecting rows and deleting them together.
 *
 * Built for the case that actually exists: forty-six workspaces left behind by
 * development signups, which one-at-a-time deletion with a typed confirmation
 * cannot realistically clear. An operator made to repeat a destructive action
 * forty times stops reading the dialog by the fifth, which is worse than one
 * bulk action they read once.
 *
 * The selection lives in context rather than in each table, so the checkbox in
 * a row and the toolbar above it cannot disagree about what is selected — the
 * failure mode where a stale count deletes more than the operator saw.
 *
 * Server side, each item still goes through the single-delete function, so a
 * live subscription or the operator's own account refuses exactly as it would
 * on its own. Nothing here is a faster path that skips the guards.
 */

type Selection = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <SelectionContext.Provider
      value={{ selected, toggle, clear: () => setSelected(new Set()) }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

function useSelection(): Selection {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("Bulk selection used outside its provider");
  }
  return context;
}

/** The checkbox on one row. */
export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
      className="size-4 accent-primary"
    />
  );
}

/**
 * The bar that appears once something is selected.
 *
 * Hidden entirely at zero rather than shown disabled: a permanently visible
 * delete control above a table of customers is an invitation to a mistake.
 */
export function BulkDeleteBar({
  kind,
}: {
  /** Which table this is, so the wording and the action match. */
  kind: "organizations" | "users" | "websites";
}) {
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const count = selected.size;
  if (count === 0) return null;

  const noun =
    kind === "organizations"
      ? `workspace${count === 1 ? "" : "s"}`
      : kind === "websites"
        ? `website${count === 1 ? "" : "s"}`
        : `account${count === 1 ? "" : "s"}`;

  function submit() {
    const ids = [...selected];
    startTransition(async () => {
      const result =
        kind === "organizations"
          ? await deleteManyOrganizations(ids, reason, confirm)
          : kind === "websites"
            ? await deleteManyWebsites(ids, reason, confirm)
            : await deleteManyUsers(ids, reason, confirm);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { deleted, failures } = result.data;
      /**
       * Partial results are reported as partial. Saying "done" when three of
       * forty refused would leave the operator believing the batch was clean.
       */
      if (failures.length > 0) {
        toast.warning(
          `Deleted ${deleted}. ${failures.length} refused — ${failures[0].error}`,
        );
      } else {
        toast.success(`Deleted ${deleted} ${noun}`);
      }

      setOpen(false);
      setReason("");
      setConfirm("");
      clear();
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">
          {count} {noun} selected
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Clear
        </button>
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete selected
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => (next ? null : setOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {count} {noun} permanently?
            </DialogTitle>
            <DialogDescription>
              {kind === "organizations"
                ? "Each workspace is removed with everything in it — websites, articles, keywords, credits and payment history. This cannot be undone."
                : kind === "websites"
                  ? "Each website is removed with its articles, keywords and connections. The workspace that owns it, its members and its payment history are kept. This cannot be undone."
                  : "Each account is removed with its sessions and sign-in methods. Their workspaces are not deleted. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="space-y-1 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              <li>
                {kind === "websites"
                  ? "Anything that cannot be deleted safely is skipped and reported — a website still being billed by Stripe."
                  : "Anything that cannot be deleted safely is skipped and reported — a workspace still being billed by Stripe, or your own account."}
              </li>
              <li>Every deletion is recorded separately in the admin log.</li>
            </ul>

            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Why?</Label>
              <Input
                id="bulk-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Clearing test data from development"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-confirm">Type DELETE to confirm</Label>
              <Input
                id="bulk-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={
                pending || reason.trim().length < 3 || confirm !== "DELETE"
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Delete {count} {noun}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
