"use client";

import { Coins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { chooseCreditWorkspaceAction } from "@/lib/partners/presentation/actions";
import { fill } from "@/lib/partners/presentation/copy";
import type { PartnerCreditsCopy } from "@/lib/partners/presentation/credits-copy";

/**
 * Partners paid in RepGet credits (lib/partners/application/use-cases/
 * partner-credits.ts): which owned workspace receives them, the rate, and
 * what was received. The rate and the history are the server's; the browser
 * sends only the chosen workspace, which the server checks the partner owns.
 */
export function CreditPayoutSetup({
  copy,
  workspaces,
  current,
  rate,
  grants,
}: {
  copy: PartnerCreditsCopy;
  workspaces: { id: string; name: string }[];
  current: string | null;
  /** "100" and "€79.00", already formatted. Null while no credit pack is on sale. */
  rate: { credits: string; price: string } | null;
  grants: { id: string; date: string; commission: string; credits: number }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState(current ?? workspaces[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const currentName = workspaces.find((workspace) => workspace.id === current)?.name ?? null;

  return (
    <section className="rounded-xl border bg-card p-6" aria-labelledby="credit-payouts-title">
      <div className="flex items-start gap-3">
        <Coins className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
          <h2 id="credit-payouts-title" className="text-base font-semibold text-foreground">{copy.title}</h2>
          {rate ? <p>{fill(copy.intro, rate)}</p> : null}
          <p>{copy.timing}</p>
          <p>{copy.refunds}</p>
        </div>
      </div>

      <p className="mt-4 text-sm" role="status">
        {currentName ? fill(copy.saved, { name: currentName }) : workspaces.length > 0 ? copy.choose : copy.noWorkspace}
      </p>

      {workspaces.length > 0 ? (
        <form
          className="mt-3 flex max-w-md flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            start(async () => {
              const result = await chooseCreditWorkspaceAction(selected);
              if (!result.ok) {
                setError(copy.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="credit-workspace">{copy.workspace}</Label>
            <select
              id="credit-workspace"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={pending}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending || !selected || selected === current}>
            {copy.save}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold">{copy.history}</h3>
      {grants.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">{copy.date}</th>
              <th className="py-1 font-normal">{copy.commission}</th>
              <th className="py-1 text-right font-normal">{copy.credits}</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((grant) => (
              <tr key={grant.id} className="border-t">
                <td className="py-1.5">{grant.date}</td>
                <td className="py-1.5 tabular-nums">{grant.commission}</td>
                <td className="py-1.5 text-right tabular-nums">{grant.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
