"use client";

import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import {
  addWebsiteMember,
  removeWebsiteMember,
  type WebsiteMember,
} from "@/lib/websites/members";

/**
 * Who else can work on this website.
 *
 * Scoped to one site on purpose: an editor invited to a client's site should
 * not gain anything on the others, which is the case workspace membership
 * cannot express.
 *
 * Matches an existing account by email rather than sending an invitation.
 * Email needs a provider, a token table and an expiry policy; matching an
 * account covers the case actually asked for — a colleague or freelancer who
 * already uses the product — and anyone else signs up first, which they would
 * have to do regardless.
 */
export function WebsiteMembers({
  websiteId,
  domain,
  members,
}: {
  websiteId: string;
  domain: string;
  members: WebsiteMember[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addWebsiteMember(websiteId, email, role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${email} can now work on ${domain}`);
      setEmail("");
      router.refresh();
    });
  }

  function remove(memberId: string, memberEmail: string) {
    setBusyId(memberId);
    startTransition(async () => {
      const result = await removeWebsiteMember(websiteId, memberId);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${memberEmail} no longer has access`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">People on {domain}</CardTitle>
        <CardDescription>
          Give someone access to this website only. They will not see your
          other sites or your billing.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="editor@example.com"
              autoComplete="off"
            />
          </div>

          <div className="w-32 space-y-2">
            <Label htmlFor="member-role">Role</Label>
            <Select
              value={role}
              onValueChange={(next) => setRole(next as "editor" | "viewer")}
            >
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending || !email.trim()}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="size-4" aria-hidden="true" />
            )}
            Invite
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          An editor can write, edit and publish articles. A viewer can read
          only.
        </p>

        {members.length === 0 ? (
          <EmptyState
            title="Nobody else yet"
            description="Invite a colleague or a freelance editor to work on this website."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name || member.email}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {member.email} · {member.role}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${member.email}`}
                  disabled={pending}
                  onClick={() => remove(member.id, member.email)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {busyId === member.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
