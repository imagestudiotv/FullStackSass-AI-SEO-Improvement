"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [instructions, setInstructions] = useState(
    voice.articleInstructions ?? "",
  );
  const [examples, setExamples] = useState(
    voice.exampleArticleUrls.join(String.fromCharCode(10)),
  );
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
        articleInstructions: instructions,
        exampleArticleUrls: examples,
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

  /**
   * flex + gap on the form because the card's own gap-(--card-spacing) applies
   * to its direct children, and this form is the single child wrapping both
   * the header and the fields — without it the description ran straight into
   * the first label.
   */
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-(--card-spacing)">
      {/*
        The other tab opens with a title and a line saying what the fields are
        for; this one went straight into an input, so the panel looked like it
        had lost its heading. Both tabs now introduce themselves the same way.
      */}
      <CardHeader>
        <CardTitle className="text-base">How we write</CardTitle>
        <CardDescription>
          The difference between an article that could belong to any business
          in your industry and one that sounds like yours. Everything here is
          optional.
        </CardDescription>
      </CardHeader>

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

        {/*
          Example articles first: they set the style for everything else, and
          answering "which of your articles do you like" is far easier than
          describing a tone from nothing.
        */}
        <div className="space-y-1.5">
          <Label htmlFor="examples">Articles you are happy with</Label>
          <textarea
            id="examples"
            rows={3}
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
            placeholder={[
              "https://yoursite.com/blog/a-post-you-like",
              "https://yoursite.com/blog/another-one",
            ].join(String.fromCharCode(10))}
            className={textarea}
          />
          <p className="text-xs text-muted-foreground">
            Up to three, one per line. We read them to match how you already
            write, which works better than describing it.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instructions">Rules for every article</Label>
          <textarea
            id="instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Never put a year in the title. Always mention we offer free delivery."
            className={textarea}
          />
          <p className="text-xs text-muted-foreground">
            Standing rules, applied to everything we write. For one specific
            article, use the instructions on that article instead.
          </p>
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
          {/*
            gap-4 to match every other field group on this form; gap-2 packed
            the six rows tighter than the fields above them.

            A real <label> rather than a span, so the platform name focuses its
            own input — the aria-label alone left the visible text inert.
          */}
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform} className="flex items-center gap-3">
                <Label
                  htmlFor={`social-${platform}`}
                  className="w-20 shrink-0 font-normal text-muted-foreground"
                >
                  {platform}
                </Label>
                <Input
                  id={`social-${platform}`}
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
          {pending ? "Saving…" : "Save how we write"}
        </Button>
      </CardFooter>
    </form>
  );
}
