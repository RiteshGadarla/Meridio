/**
 * FILE: frontend/src/lib/format.ts
 * PURPOSE: Display formatting for money, numbers and dates (Intl only, never manual string math).
 * LAYER: Utility
 * USED BY: product table, dashboard, forms
 * NOTES: Money arrives from the API as a decimal STRING ("1234.50"). It is only converted for
 *        display; the original string is what gets sent back on save.
 */
import { DEFAULT_CURRENCY } from '@meridio/contracts';

/** Locale for numbers and dates. */
export const FORMAT_LOCALE = 'en-US';
/** Currency shown until the organization's own choice (Settings) is known: Indian rupees. */
export const FORMAT_CURRENCY = DEFAULT_CURRENCY;

/**
 * Locale used to format money in a given currency. Rupees use Indian digit grouping (1,23,456.00);
 * everything else uses en-US grouping.
 */
function moneyLocale(currency: string): string {
  return currency === 'INR' ? 'en-IN' : FORMAT_LOCALE;
}

/** Shown for an optional price that was never set. */
export const NOT_SET = 'Not set';

/**
 * Formats a money value.
 * @param value decimal string from the API, a number, or null/undefined/empty
 * @returns "₹1,234.50" (INR) or the organization's currency, or "Not set" when there is no price
 * @example formatCurrency('1234.5') // "₹1,234.50"
 */
export function formatCurrency(
  value: string | number | null | undefined,
  currency: string = FORMAT_CURRENCY,
  locale: string = moneyLocale(currency),
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
