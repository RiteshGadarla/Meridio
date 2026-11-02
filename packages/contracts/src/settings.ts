/**
 * FILE: packages/contracts/src/settings.ts
 * PURPOSE: Schema and DTO for organization inventory settings.
 * LAYER: Shared contract
 * USED BY: backend settings module, frontend settings page (Stage 10)
 * DEPENDS ON: zod
 */
import { z } from 'zod';

/** Body of PATCH /settings. */
export const updateSettingsSchema = z.object({
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
  organizationName: string;
}
