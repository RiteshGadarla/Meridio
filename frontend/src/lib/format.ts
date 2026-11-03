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

/**
 * Formats an ISO timestamp as a short date and time in the viewer's own time zone.
 * WHY not UTC (unlike formatDate): "last updated" is read as "when did I do this?".
 * @example formatDateTime('2026-11-02T10:00:00Z') // "Nov 2, 2026, 3:30 PM" (in IST)
 */
export function formatDateTime(iso: string, locale: string = FORMAT_LOCALE): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/**
 * Short relative time for feeds. Falls back to a date after a week.
 * @param now injectable for tests
 * @example formatRelativeTime('2026-11-03T10:00:00Z', new Date('2026-11-03T12:00:00Z')) // "2 hours ago"
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
  locale: string = FORMAT_LOCALE,
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day');
  return formatDate(iso, locale);
}
