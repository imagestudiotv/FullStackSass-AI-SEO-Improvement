"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBrandVoice } from "@/lib/brand/actions";
import { SOCIAL_PLATFORMS, type BrandVoiceView } from "@/lib/brand/shared";

/**
 * How the customer wants their articles to sound.
 *
 * Every field is optional and articles work without any of them — this only
 * makes the writing specific to the business rather than generic to the
 * industry.
 */
export function BrandVoiceForm({
  websiteId,
  voice,
}: {
  websiteId: string;
  voice: BrandVoiceView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [tone, setTone] = useState(voice.tone ?? "");
  const [vocabulary, setVocabulary] = useState(voice.vocabulary ?? "");
  const [avoid, setAvoid] = useState(voice.avoid ?? "");
  const [usps, setUsps] = useState(voice.usps.join("\n"));
  const [facts, setFacts] = useState(voice.facts.join("\n"));
  const [social, setSocial] = useState<Record<string, string>>(() =>
    Object.fromEntries(voice.socialLinks.map((l) => [l.platform, l.url])),
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBrandVoice(websiteId, {
        tone,
        vocabulary,
        avoid,
        usps,
        facts,
        socialLinks: Object.entries(social)
          .filter(([, url]) => url.trim())
          .map(([platform, url]) => ({ platform, url })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved — your next articles will use this");
      router.refresh();
    });
  }

  const textarea =
    "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="tone">How should your articles sound?</Label>
          <Input
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Friendly and reassuring, not clinical"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="facts">Facts about your business</Label>
          <textarea
            id="facts"
            rows={4}
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            placeholder={"Open since 2004\nFive dentists on the team\nFree parking on site"}
            className={textarea}
          />
          <p className="text-xs text-muted-foreground">
            One per line. We never make up details about your business — these
            are the only specifics we will mention, so anything you add here
            must be true.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="usps">What makes you different?</Label>
          <textarea
            id="usps"
            rows={3}
            value={usps}
            onChange={(e) => setUsps(e.target.value)}
            placeholder={"Same-day emergency appointments\nWe see nervous patients"}
            className={textarea}
          />
          <p className="text-xs text-muted-foreground">One per line.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vocabulary">Words you prefer</Label>
            <Input
              id="vocabulary"
              value={vocabulary}
              onChange={(e) => setVocabulary(e.target.value)}
              placeholder="Say treatment, not procedure"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avoid">Words to avoid</Label>
            <Input
              id="avoid"
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="Never say cheap"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Your social profiles</Label>
          <p className="text-xs text-muted-foreground">
            Mentioned once in an article where it reads naturally. Leave blank
            to skip.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-sm text-muted-foreground">
                  {platform}
                </span>
                <Input
                  aria-label={`${platform} profile URL`}
                  value={social[platform] ?? ""}
                  onChange={(e) =>
                    setSocial((prev) => ({
                      ...prev,
                      [platform]: e.target.value,
                    }))
                  }
                  placeholder="https://…"
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </CardFooter>
    </form>
  );
}
