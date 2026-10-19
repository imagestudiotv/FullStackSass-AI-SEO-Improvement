"use client";

import { MessageSquarePlus } from "lucide-react";

import { FeedbackForm } from "@/components/feedback-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { FeedbackCopy } from "@/lib/feedback/copy";
import type { Locale } from "@/lib/i18n/config";

/**
 * "Feedback" in the signed-in header: the feedback form in a dialog, for a
 * customer (their account address gets the reply, so none is asked for).
 */
export function FeedbackButton({ copy, locale, accountEmail }: { copy: FeedbackCopy; locale: Locale; accountEmail: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={copy.title} title={copy.title}>
          <MessageSquarePlus aria-hidden />
          <span className="hidden lg:inline">{copy.button}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro}</DialogDescription>
        </DialogHeader>
        <FeedbackForm copy={copy} locale={locale} source="dashboard" accountEmail={accountEmail} />
      </DialogContent>
    </Dialog>
  );
}
