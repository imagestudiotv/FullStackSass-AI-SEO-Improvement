/**
 * The platform marks for the "works with" grid.
 *
 * Inline SVG rather than image files, for the reason GoogleMark is inline: a
 * mark at this size is smaller than the request that would fetch it, and a
 * local file is one more thing to keep in step with a redesign.
 *
 * Each is drawn from the platform's own glyph in a single colour, on that
 * platform's brand tint. Simplified silhouettes rather than exact reproductions
 * — a monochrome glyph identifies the platform without reproducing a logo we
 * have no licence to alter, which is the trademark question the previous
 * text-only band was avoiding altogether.
 *
 * aria-hidden throughout: every card already names its platform in text, so a
 * screen reader announcing the mark as well would read the name twice.
 */

type MarkProps = { className?: string };

export function WordPressMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.2a8.8 8.8 0 0 1 3.96.94h-.29c-.72 0-1.23.63-1.23 1.3 0 .61.35 1.12.72 1.73.28.49.6 1.12.6 2.03 0 .63-.24 1.36-.56 2.37l-.73 2.45-2.65-7.9c.44-.02.84-.07.84-.07.4-.05.35-.63-.04-.61 0 0-1.19.09-1.96.09-.72 0-1.93-.1-1.93-.1-.4-.01-.44.59-.05.61 0 0 .38.05.77.07l1.13 3.1-1.59 4.77-2.65-7.87c.44-.02.84-.07.84-.07.4-.05.35-.63-.04-.61 0 0-1.19.09-1.96.09-.14 0-.3 0-.47-.01A8.79 8.79 0 0 1 12 3.2ZM3.62 8.35l4.6 12.6A8.8 8.8 0 0 1 3.2 12c0-1.29.28-2.51.78-3.61l-.36-.04Zm16.4 1.35c.2.64.32 1.42.32 2.26 0 1.1-.21 2.34-.82 3.9l-2.3 6.02A8.8 8.8 0 0 0 20.8 12c0-1.35-.3-2.63-.85-3.77l.07 1.47ZM12.2 13.6l2.25 6.18a.8.8 0 0 0 .06.12 8.83 8.83 0 0 1-5.5-.15l3.19-6.15Z"
      />
    </svg>
  );
}

export function GhostMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.9 2 3 5.9 3 10.6v9.2c0 .8.9 1.3 1.6.9l1.9-1.2c.3-.2.7-.2 1 0l1.7 1.1c.3.2.8.2 1.1 0l1.7-1.1c.3-.2.7-.2 1 0l1.7 1.1c.3.2.8.2 1.1 0l1.7-1.1c.3-.2.7-.2 1 0l1.9 1.2c.7.4 1.6-.1 1.6-.9v-9.2C21 5.9 17.1 2 12 2Zm-2.6 9.4a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm5.2 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z"
      />
    </svg>
  );
}

export function ShopifyMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.3 4.3c-.1-.1-.3-.1-.4-.1l-.9.2c-.3-.9-.9-1.8-2-1.8h-.2c-.3-.4-.7-.6-1.1-.6-2 .1-3 2.6-3.3 3.9l-1.4.4c-.4.1-.5.2-.5.6L4 19.6l8.3 1.6 4.5-1V4.6c0-.2-.1-.3-.2-.3h-1.3ZM11.6 5l-1.6.5c.2-.9.7-1.9 1.5-2.1.1.3.2.9.1 1.6Zm-1.3-2.6c.1 0 .3.1.4.2-.9.5-1.5 1.7-1.7 3l-1.3.4c.3-1.3 1.1-3.5 2.6-3.6Zm.3 9.4c-.3-.2-1-.4-1-1 0-.4.3-.7.9-.7.8 0 1.5.3 1.5.3l.5-1.6s-.5-.4-1.8-.4c-1.9 0-3.2 1.1-3.2 2.6 0 .9.6 1.5 1.4 2 .6.4 .9.7.9 1.1 0 .4-.4.8-1 .8-.9 0-1.8-.5-1.8-.5l-.5 1.6s.8.5 2.1.5c2 0 3.4-1 3.4-2.7 0-1-.7-1.7-1.4-2Z"
      />
    </svg>
  );
}

export function WebflowMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22 6.5 17.4 17.5h-3.2l1.9-4.6h-.1c-1.6 2.5-3.9 4-7.1 4.6L10.7 13c.5-1.3.7-2.2.7-2.7 0-.5-.3-.8-.8-.8-.9 0-1.8 1.2-2.4 3.2L6.5 17.5H3.4L7.9 6.5H11l-.9 2.3h.1c1.3-1.8 2.9-2.7 4.6-2.7 1.3 0 2.1.8 2.1 2.2 0 .5-.1 1.1-.3 1.8L18.6 6.5H22Z"
      />
    </svg>
  );
}

export function WixMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.6 8.4 2 15.6h2.2l1.5-4.6 1.4 4.6h2.2L6.7 8.4H4.6Zm5.6 0v7.2h2V8.4h-2Zm3.6 0 2.4 3.5-2.5 3.7h2.4l1.3-2.1 1.3 2.1H21l-2.5-3.7 2.4-3.5h-2.3l-1.2 1.9-1.2-1.9h-2.4Zm-3.6-2.9a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z"
      />
    </svg>
  );
}

export function SearchConsoleMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25a1 1 0 0 0 1.42-1.42l-4.25-4.24A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-2.6 5.7 1.7 1.7 3.4-3.4 1.06 1.06-4.46 4.46-2.76-2.76L7.9 10.7Z"
      />
    </svg>
  );
}

export function WebhookMark({ className = "size-6" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.6 7.4a3.1 3.1 0 1 1 4.5 2.8l2.2 3.8h.3a3.1 3.1 0 1 1-3 3.9h-4.4a3.1 3.1 0 1 1-3.6-3.8l1.4-2.4 1.7 1-1.5 2.6a1.3 1.3 0 1 0 1.8 1.5l.3-.5h5.9a3.1 3.1 0 0 1 1.8-1.8l-3.3-5.7a1.3 1.3 0 1 0-1.6-1.7l-1.7-.5a3.1 3.1 0 0 1 .8-1.2l-1.6 1.9Zm-.4 1.9L7.5 14a1.3 1.3 0 1 1-1.7-1l2.7-4.6 1.7.9Zm7.7 6.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z"
      />
    </svg>
  );
}
