"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Organization = { id: string; name: string; slug: string };

type OrgSwitcherProps = {
  currentOrgId: string;
  currentOrgName: string;
  role: string;
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

export function OrgSwitcher({
  currentOrgId,
  currentOrgName,
  role,
}: OrgSwitcherProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [switching, setSwitching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void authClient.organization.list().then(({ data }) => {
      if (!cancelled && data) {
        setOrgs(data as Organization[]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSwitch(organizationId: string) {
    if (organizationId === currentOrgId) return;
    setSwitching(true);
    const { error } = await authClient.organization.setActive({ organizationId });
    if (error) {
      setSwitching(false);
      toast.error(error.message ?? "Could not switch organization");
      return;
    }
    // Server components read the active organization, so they must re-render.
    router.refresh();
    setSwitching(false);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const { data, error } = await authClient.organization.create({
      name: newName,
      slug: `${slugify(newName)}-${Math.random().toString(36).slice(2, 8)}`,
    });
    if (error || !data) {
      setCreating(false);
      toast.error(error?.message ?? "Could not create organization");
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    setOrgs((prev) => [...prev, data as Organization]);
    setNewName("");
    setDialogOpen(false);
    setCreating(false);
    toast.success(`Created ${data.name}`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto gap-2 px-2 py-1.5"
            disabled={switching}
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm font-medium">{currentOrgName}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {role}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.length === 0 ? (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          ) : (
            orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => handleSwitch(org.id)}
              >
                <Check
                  className={
                    org.id === currentOrgId
                      ? "size-4 opacity-100"
                      : "size-4 opacity-0"
                  }
                />
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Each organization has its own websites, content and billing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 py-4">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Acme Marketing"
                required
                minLength={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
