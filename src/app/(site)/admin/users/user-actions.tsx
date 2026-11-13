"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  WorkspaceDeleteItem,
  WorkspaceDialogs,
  WorkspaceMenuItems,
  type WorkspaceMode,
  type WorkspaceTarget,
} from "../organizations/workspace-actions";
import { DeleteUserDialog } from "./delete-user";

/**
 * One menu per PERSON: the actions for each workspace they belong to, under
 * that workspace's name, then the account itself. Workspace actions are
 * scoped to the WORKSPACE, not the person - suspension stops generation and
 * publishing for a workspace, and someone in three of them cannot be
 * suspended as an individual - so each group names the workspace it acts on.
 */
export function UserActions({
  userId,
  email,
  workspaces,
  isSelf,
}: {
  userId: string;
  email: string;
  workspaces: WorkspaceTarget[];
  /** The signed-in administrator's own account, which the server refuses to delete. */
  isSelf: boolean;
}) {
  const [active, setActive] = useState<{ organizationId: string; mode: WorkspaceMode } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuId = useId();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${email}`}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {workspaces.map((workspace, index) => {
            const select = (mode: WorkspaceMode) => setActive({ organizationId: workspace.organizationId, mode });
            const labelId = `${menuId}-workspace-${index}`;
            // With several workspaces in one menu, each item also names its workspace for screen readers.
            const context = workspaces.length > 1 ? workspace.organizationName : undefined;
            return (
              <DropdownMenuGroup key={workspace.organizationId} aria-labelledby={labelId}>
                <DropdownMenuLabel id={labelId} className="truncate" title={workspace.organizationName}>
                  Workspace · {workspace.organizationName}
                </DropdownMenuLabel>
                <WorkspaceMenuItems target={workspace} onSelect={select} context={context} />
                <WorkspaceDeleteItem onSelect={select} context={context} />
                <DropdownMenuSeparator />
              </DropdownMenuGroup>
            );
          })}
          <DropdownMenuGroup aria-labelledby={`${menuId}-account`}>
            <DropdownMenuLabel id={`${menuId}-account`}>Account</DropdownMenuLabel>
            {/* Reachable when refused, so the reason is heard; choosing it does nothing. */}
            <DropdownMenuItem
              variant="destructive"
              aria-disabled={isSelf || undefined}
              className={isSelf ? "opacity-60" : undefined}
              onSelect={(event) => {
                if (isSelf) return void event.preventDefault();
                setDeleting(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete account…
              {isSelf ? <span className="ml-auto pl-3 text-xs text-muted-foreground">Your account</span> : null}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {workspaces.map((workspace) => (
        <WorkspaceDialogs
          key={workspace.organizationId}
          target={workspace}
          mode={active?.organizationId === workspace.organizationId ? active.mode : null}
          onClose={() => setActive(null)}
        />
      ))}
      <DeleteUserDialog userId={userId} email={email} open={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}
