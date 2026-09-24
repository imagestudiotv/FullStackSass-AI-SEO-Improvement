/**
 * PayPal's own mark, inline.
 *
 * Their brand guidelines require the real logo on a payment control rather
 * than a generic card or wallet icon - a customer scanning for a way to pay
 * looks for the mark they recognise, and a stand-in reads as a third-party
 * imitation on the one screen where trust decides whether they continue.
 *
 * Its own component because two screens render a PayPal button: the plan step
 * during signup and the billing page afterwards. Two hand-copied SVGs are two
 * chances for one of them to drift into a slightly wrong logo. Same reasoning
 * as GoogleMark beside it.
 *
 * Inlined rather than fetched: it is a few hundred bytes, and a remote image
 * on a checkout button is a request that can fail while somebody is deciding
 * whether to pay.
 *
 * THE TWO BLUES ARE THE BRAND'S, not a gradient approximation. PayPal's mark
 * is two overlapping "P" shapes - the darker navy behind, the lighter blue in
 * front - and flattening them to one colour is the most common way this logo
 * is got wrong.
 *
 * aria-hidden: every button that carries this also says "PayPal" in its
 * label, so announcing the mark as well would read the word twice.
 *
 * THE VIEWBOX IS TIGHT TO THE ARTWORK, and that is the whole reason this
 * reads at a sensible size. Drawn inside a square 24x24 box the mark filled
 * 59% of the width and 50% of the height - it is a tall narrow glyph in a
 * square frame - so at size-5 the visible logo was barely 10px and looked
 * shrunken next to its own label. Measured the paths and cropped the box to
 * them with a hair of padding, which makes the drawing fill the space it is
 * given instead of floating in the middle of it.
 *
 * The default is size-6 rather than size-4 for the same reason: this sits on
 * a 48px payment button, not in a line of body text.
 */
export function PayPalMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="1.86 2.26 15.8 19.48"
      aria-hidden="true"
    >
      {/* The back "P" - darker navy. */}
      <path
        fill="#003087"
        d="M7.08 21.34a.64.64 0 0 1-.63-.74l.29-1.84.02-.1h2.4c3.6 0 6.38-1.46 7.19-5.69.03-.16.06-.31.08-.46a4.4 4.4 0 0 0-.7-3.87 3.36 3.36 0 0 0-.98-.85c.52 2.9-.39 5.28-2.1 6.8-1.42 1.26-3.4 1.8-5.8 1.8h-.9a.8.8 0 0 0-.79.68l-.7 4.27Z"
      />
      {/* The front "P" - lighter blue. */}
      <path
        fill="#0070E0"
        d="M4.9 2.66h6.28c2.12 0 3.74.46 4.6 1.44.8.9 1.04 2.05.75 3.6l-.02.1v.36c-.03.15-.05.3-.09.46-.8 4.23-3.58 5.7-7.18 5.7H7.6l-1.1 6.94a.64.64 0 0 1-.63.54H2.78a.53.53 0 0 1-.52-.62L4.9 2.66Z"
      />
      {/* The highlight that separates the two shapes. */}
      <path
        fill="#001C64"
        d="M16.53 7.8v.36c-.03.15-.05.3-.09.46-.8 4.23-3.58 5.7-7.18 5.7H7.6l-.83 5.24h2.4c3.6 0 6.37-1.46 7.18-5.69.03-.16.06-.31.08-.46a4.4 4.4 0 0 0-.7-3.87 3.36 3.36 0 0 0-1.2-.94Z"
      />
    </svg>
  );
}
