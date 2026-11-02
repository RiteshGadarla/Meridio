/**
 * FILE: frontend/src/lib/format.test.ts
 * PURPOSE: Unit tests for display formatting.
 */
import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatNumber, NOT_SET } from './format';

// Protects: prices from the API (strings) display correctly and missing prices are explicit.
describe('formatCurrency', () => {
  it('formats a decimal string', () => {
    expect(formatCurrency('1234.5')).toBe('$1,234.50');
  });
  it('formats numbers and other currencies/locales', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency('1234.5', 'INR', 'en-IN')).toBe('₹1,234.50');
  });
  it.each([null, undefined, '', 'abc'])('shows "Not set" for %s', (v) => {
    expect(formatCurrency(v)).toBe(NOT_SET);
  });
});

describe('formatNumber / formatDate', () => {
  it('groups digits', () => expect(formatNumber(12500)).toBe('12,500'));
  it('formats ISO dates in UTC and tolerates bad input', () => {
    expect(formatDate('2026-11-02T10:00:00Z')).toBe('Nov 2, 2026');
    expect(formatDate('nope')).toBe('');
  });
});
