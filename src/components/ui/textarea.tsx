import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Multi-line input, drawn exactly like Input (same border, radius, focus
 * ring, invalid and disabled states) so a form that mixes the two reads as
 * one set of controls. Pages used to hand-roll textareas with a different
 * radius and a shadow, so long fields looked like a different product.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
