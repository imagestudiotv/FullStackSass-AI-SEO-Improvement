/**
 * When a referred customer's payments earn commission.
 *
 * Eligibility lasts `months` calendar months from the FIRST qualifying
 * successful payment, as a UTC window that includes its start and excludes
 * its end. Times are the provider's original payment timestamps, never the
 * time a webhook arrived. Annual payments follow the same rule: an annual
 * renewal twelve months after the first payment falls on the window's end
 * and is outside it.
 *
 * A calendar month from the 31st lands on the last day of a shorter month
 * (31 January + 1 month = 28 or 29 February), at the same time of day.
 */

export type EligibilityWindow = { start: Date; end: Date };

export function addCalendarMonthsUtc(from: Date, months: number): Date {
  if (!Number.isInteger(months)) throw new Error("months must be an integer");
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

export function eligibilityWindow(firstQualifyingPaymentAt: Date, months: number): EligibilityWindow {
  return { start: firstQualifyingPaymentAt, end: addCalendarMonthsUtc(firstQualifyingPaymentAt, months) };
}

export function isWithinWindow(window: EligibilityWindow, paidAt: Date): boolean {
  const t = paidAt.getTime();
  return t >= window.start.getTime() && t < window.end.getTime();
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
