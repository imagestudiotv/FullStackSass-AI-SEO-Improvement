"use client";

import { CheckCircle2, ExternalLink, Loader2, Plug, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectWordPress,
  disconnectWordPress,
  type IntegrationView,
} from "@/lib/publishing/actions";

export function WordPressPanel({
  websiteId,
  integration,
}: {
  websiteId: string;
  integration: IntegrationView | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await connectWordPress(websiteId, {
        siteUrl,
        username,
        applicationPassword: password,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Cleared immediately: no reason to keep a credential in browser memory
      // after it has been stored.
      setPassword("");
      setOpen(false);
      toast.success(`Connected to ${result.data.siteName}`);
      router.refresh();
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectWordPress(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("WordPress disconnected");
      router.refresh();
    });
  }

  const connected = integration?.status === "connected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="size-4" />
              WordPress
              {connected ? (
                <Badge>
                  <CheckCircle2 className="size-3" />
                  Connected
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              {connected
                ? `Publishing to ${integration.siteName ?? "your site"} as ${integration.username}`
                : "Connect your site to publish articles directly from here."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {connected && !open ? (
        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Change credentials
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={pending}
          >
            <Unplug className="size-4" />
            Disconnect
          </Button>
        </CardFooter>
      ) : null}

      {!connected && !open ? (
        <CardFooter>
          <Button onClick={() => setOpen(true)}>Connect WordPress</Button>
        </CardFooter>
      ) : null}

      {open ? (
        <form onSubmit={handleConnect}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wp-url">WordPress site address</Label>
              <Input
                id="wp-url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wp-user">WordPress username</Label>
              <Input
                id="wp-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wp-pass">Application password</Label>
              <Input
                id="wp-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={integration?.passwordHint ?? "xxxx xxxx xxxx xxxx"}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">
                Not your login password. In WordPress go to{" "}
                <strong>Users → Profile → Application Passwords</strong>, add
                one named &quot;SEO Platform&quot;, and paste it here. You can
                revoke it there at any time.{" "}
                <a
                  href="https://wordpress.org/documentation/article/application-passwords/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  How to
                  <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
          </CardContent>

          <CardFooter className="gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Connect"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setPassword("");
              }}
            >
              Cancel
            </Button>
          </CardFooter>
        </form>
      ) : null}
    </Card>
  );
}
