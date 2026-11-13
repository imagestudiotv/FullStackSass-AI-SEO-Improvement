/**
 * Money on the payments screen, formatted one way for the table, the refund
 * dialog and its toasts: the row's own currency, cents to units exactly as
 * stored (cents / 100). Shared by the server page and the client dialog, so
 * nothing here may touch the server or the browser.
 */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    // A currency code Intl does not know: still show the real amount and code.
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
