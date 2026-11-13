"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteManyOrganizations,
  deleteManyUsers,
  deleteManyWebsites,
} from "@/lib/admin/operations";

import { AdminSelectionBar } from "./_ui/table";
import {
  CONFIRM_WORD,
  ConfirmField,
  DialogError,
  DialogNotes,
  ReasonField,
  reasonOk,
  Spinner,
} from "./organizations/dialog-fields";

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
 * a row and the bar above it cannot disagree about what is selected — the
 * failure mode where a stale count deletes more than the operator saw.
 *
 * THE SELECTION IS THIS PAGE'S ROWS ONLY. The provider is given the rows on
 * screen and a selection belongs to that exact set: another page, a search, a
 * filter, or a refresh after a deletion drops it. (Next keeps a page's client
 * state across search-param navigations, so without this a selection made on
 * page 1 was still counted - and deleted - from page 2.)
 *
 * Server side, each item still goes through the single-delete function, so a
 * live subscription or the operator's own account refuses exactly as it would
 * on its own. Nothing here is a faster path that skips the guards.
 */

export type BulkItem = {
  id: string;
  /** How the row is named in the dialog and in a refusal (workspace name, domain, email). */
  label: string;
  /** False when the server would always refuse it (the operator's own account). */
  selectable?: boolean;
  /** Why it cannot be selected. */
  reason?: string;
};

type Selection = {
  items: BulkItem[];
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);
const NONE: ReadonlySet<string> = new Set();

export function BulkSelectionProvider({ items, children }: { items: BulkItem[]; children: ReactNode }) {
  const pageKey = items.map((item) => item.id).join("\n");
  const [state, setState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: pageKey, ids: NONE });
  // A selection made against other rows is no selection at all.
  const selected = state.key === pageKey ? state.ids : NONE;

  function update(change: (current: Set<string>) => Set<string>) {
    setState((current) => ({
      key: pageKey,
      ids: change(new Set(current.key === pageKey ? current.ids : NONE)),
    }));
  }

  const selectable = items.filter((item) => item.selectable !== false).map((item) => item.id);

  return (
    <SelectionContext.Provider
      value={{
        items,
        selected,
        toggle: (id) =>
          update((next) => {
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        setAll: (on) => update(() => new Set<string>(on ? selectable : [])),
        clear: () => update(() => new Set<string>()),
      }}
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

const checkboxClass =
  "size-4 cursor-pointer accent-primary align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40";

/** The checkbox on one row. */
export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  const { items, selected, toggle } = useSelection();
  const item = items.find((entry) => entry.id === id);
  const disabled = item?.selectable === false;
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
      disabled={disabled}
      title={disabled ? item?.reason : undefined}
      className={checkboxClass}
    />
  );
}

/** A table row that shows when it is selected. */
export function BulkRow({ id, children }: { id: string; children: ReactNode }) {
  const { selected } = useSelection();
  return <TableRow data-state={selected.has(id) ? "selected" : undefined}>{children}</TableRow>;
}

/** The header checkbox: every selectable row on THIS page, never every match. */
export function BulkSelectAll({ label }: { label: string }) {
  const { items, selected, setAll } = useSelection();
  const ids = items.filter((item) => item.selectable !== false).map((item) => item.id);
  const chosen = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && chosen === ids.length;
  return (
    <input
      type="checkbox"
      ref={(element) => {
        if (element) element.indeterminate = chosen > 0 && !all;
      }}
      checked={all}
      onChange={() => setAll(!all)}
      disabled={ids.length === 0}
      aria-label={label}
      className={checkboxClass}
    />
  );
}

type Outcome = {
  attempted: number;
  deleted: number;
  refused: { id: string; label: string; error: string }[];
};

/**
 * The bar that appears once something is selected, and the dialog behind it.
 * Put it in AdminTableCard's `toolbar` slot.
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
  const { items, selected, clear } = useSelection();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /**
   * What the dialog is about, fixed when it opens: the rows listed, counted
   * and sent are the ones the operator read, and the title does not flick to
   * "0" when the selection is cleared on the way out.
   */
  const [batch, setBatch] = useState<BulkItem[]>([]);
  const [pending, startTransition] = useTransition();

  const count = selected.size;
  const noun = (value: number) =>
    kind === "organizations"
      ? `workspace${value === 1 ? "" : "s"}`
      : kind === "websites"
        ? `website${value === 1 ? "" : "s"}`
        : `account${value === 1 ? "" : "s"}`;

  function start() {
    setBatch(items.filter((item) => selected.has(item.id)));
    setOpen(true);
  }

  /** Cancel, Esc, the overlay, the X and Done all land here; never while the server is working. */
  function close() {
    if (pending) return;
    setOpen(false);
    setReason("");
    setConfirm("");
    setError(null);
    setOutcome(null);
  }

  function submit() {
    const ids = batch.map((item) => item.id);
    const labels = new Map(batch.map((item) => [item.id, item.label]));
    setError(null);
    startTransition(async () => {
      const result =
        kind === "organizations"
          ? await deleteManyOrganizations(ids, reason, confirm)
          : kind === "websites"
            ? await deleteManyWebsites(ids, reason, confirm)
            : await deleteManyUsers(ids, reason, confirm);

      if (!result.ok) {
        // Nothing was deleted: the dialog stays open with what was typed.
        setError(result.error);
        toast.error(result.error);
        return;
      }

      const { deleted, failures } = result.data;
      /**
       * Partial results are reported as partial. Saying "done" when three of
       * forty refused would leave the operator believing the batch was clean -
       * so the dialog stays open and names every refused row with the
       * server's reason, instead of a toast that shows only the first.
       */
      if (failures.length > 0) {
        toast.warning(`Deleted ${deleted}. ${failures.length} refused - ${failures[0].error}`);
        setOutcome({
          attempted: ids.length,
          deleted,
          refused: failures.map((failure) => ({
            id: failure.id,
            label: labels.get(failure.id) ?? failure.id,
            error: failure.error,
          })),
        });
        setReason("");
        setConfirm("");
      } else {
        toast.success(`Deleted ${deleted} ${noun(deleted)}`);
        setOpen(false);
        setReason("");
        setConfirm("");
      }

      clear();
      router.refresh();
    });
  }

  const description =
    kind === "organizations"
      ? "Each workspace is removed with everything in it - websites, articles, keywords, credits and payment history. This cannot be undone."
      : kind === "websites"
        ? "Each website is removed with its articles, keywords and connections. The workspace that owns it, its members and its payment history are kept. This cannot be undone."
        : "Each account is removed with its sessions and sign-in methods. Their workspaces are not deleted. This cannot be undone.";

  return (
    <>
      <AdminSelectionBar count={count} onClear={clear}>
        <Button variant="destructive" size="sm" onClick={start}>
          <Trash2 aria-hidden="true" />
          Delete selected
        </Button>
      </AdminSelectionBar>

      <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
        <DialogContent className="sm:max-w-lg">
          {outcome ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Deleted {outcome.deleted} of {outcome.attempted} {noun(outcome.attempted)}
                </DialogTitle>
                <DialogDescription>
                  {outcome.refused.length} {outcome.refused.length === 1 ? "was" : "were"} refused and left exactly as{" "}
                  {outcome.refused.length === 1 ? "it was" : "they were"}. The reason for each is below.
                </DialogDescription>
              </DialogHeader>
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm" aria-label="Refused">
                {outcome.refused.map((item) => (
                  <li key={item.id} className="px-3 py-2">
                    <p className="font-medium wrap-anywhere">{item.label}</p>
                    <p className="mt-0.5 text-muted-foreground wrap-anywhere">{item.error}</p>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button onClick={close}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  Delete {batch.length} {noun(batch.length)} permanently?
                </DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Selected on this page ({batch.length})
                  </p>
                  <ul className="max-h-32 overflow-y-auto rounded-lg border px-3 py-2 text-sm" aria-label="Selected">
                    {batch.map((item) => (
                      <li key={item.id} className="truncate" title={item.label}>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <DialogNotes>
                  <li>
                    {kind === "organizations"
                      ? "Anything that cannot be deleted safely is skipped and reported - a workspace still being billed by Stripe or PayPal, or with a checkout still open."
                      : kind === "websites"
                        ? "Anything that cannot be deleted safely is skipped and reported - a website still being billed by Stripe or PayPal, or with a checkout still open."
                        : "Anything that cannot be deleted safely is skipped and reported - your own account."}
                  </li>
                  <li>Every deletion is recorded separately in the admin log.</li>
                </DialogNotes>

                <ReasonField
                  id="bulk-reason"
                  value={reason}
                  onChange={setReason}
                  placeholder="Clearing test data from development"
                  disabled={pending}
                />
                <ConfirmField id="bulk-confirm" value={confirm} onChange={setConfirm} disabled={pending} />
                <DialogError message={error} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={submit}
                  disabled={pending || batch.length === 0 || !reasonOk(reason) || confirm !== CONFIRM_WORD}
                >
                  {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
                  Delete {batch.length} {noun(batch.length)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
