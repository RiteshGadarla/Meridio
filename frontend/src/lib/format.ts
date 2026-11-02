/**
 * FILE: frontend/src/lib/format.ts
 * PURPOSE: Display formatting for money, numbers and dates (Intl only, never manual string math).
 * LAYER: Utility
 * USED BY: product table, dashboard, forms
 * NOTES: Money arrives from the API as a decimal STRING ("1234.50"). It is only converted for
 *        display; the original string is what gets sent back on save.
 */

/** Locale and currency for display. Change here to localise the whole app. */
export const FORMAT_LOCALE = 'en-US';
export const FORMAT_CURRENCY = 'USD';

/** Shown for an optional price that was never set. */
export const NOT_SET = 'Not set';

/**
 * Formats a money value.
 * @param value decimal string from the API, a number, or null/undefined/empty
 * @returns "$1,234.50", or "Not set" when there is no price
 * @example formatCurrency('1234.5') // "$1,234.50"
 */
export function formatCurrency(
  value: string | number | null | undefined,
  currency: string = FORMAT_CURRENCY,
  locale: string = FORMAT_LOCALE,
): string {
  if (value === null || value === undefined || value === '') return NOT_SET;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return NOT_SET;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

/** Formats an integer with grouping. @example formatNumber(12500) // "12,500" */
export function formatNumber(value: number, locale: string = FORMAT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Formats an ISO timestamp as a short date. @example formatDate('2026-11-02T10:00:00Z') // "Nov 2, 2026" */
export function formatDate(iso: string, locale: string = FORMAT_LOCALE): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}
