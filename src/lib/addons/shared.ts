/**
 * Types shared between the add-on actions and the billing UI.
 *
 * Separate from actions.ts because that file carries "use server", where every
 * export must be an async function.
 */

export type AddonRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  /** Link credits granted on purchase; 0 for a service we fulfil by hand. */
  creditsGranted: number;
  /** "credits" | "service". */
  kind: string;
  /** False until a Stripe price exists, so the UI can say so. */
  purchasable: boolean;
};

export type PurchaseRow = {
  id: string;
  name: string;
  kind: string;
  pricePaidCents: number;
  currency: string;
  /** "paid" | "fulfilled". */
  status: string;
  fulfilledAt: Date | null;
  createdAt: Date;
};
