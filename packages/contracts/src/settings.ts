/**
 * FILE: packages/contracts/src/settings.ts
 * PURPOSE: Schema and DTO for organization inventory settings.
 * LAYER: Shared contract
 * USED BY: backend settings module, frontend settings page (Stage 10)
 * DEPENDS ON: zod
 */
import { z } from 'zod';

/** Body of PATCH /settings. */
/**
 * Currencies an organization can display money in (major world currencies). INR is the default.
 * WHY a fixed list: it keeps the API strict and gives the settings dropdown one source of truth.
 * Money is still stored as a plain decimal; the currency only changes how it is DISPLAYED.
 */
export const CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'SGD',
  'AED',
] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Currency used when an organization has not chosen one (and for rows that predate the setting). */
export const DEFAULT_CURRENCY: Currency = 'INR';

export const updateSettingsSchema = z.object({
  /** Optional so existing API callers that only send the threshold keep working. */
  currency: z.enum(CURRENCIES, { message: 'Choose a supported currency' }).optional(),
  defaultLowStockThreshold: z
    .number({ message: 'Threshold must be a number' })
    .int('Threshold must be a whole number')
    .min(0, 'Threshold must be zero or positive')
    .max(100_000, 'Threshold must be at most 100,000'),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Returned by GET and PATCH /settings. */
export interface SettingsDto {
  defaultLowStockThreshold: number;
  currency: Currency;
  organizationName: string;
}
