/**
 * FILE: backend/src/modules/settings/settings.service.ts
 * PURPOSE: Reads and updates the caller's organization inventory settings.
 * LAYER: Service (Route -> Middleware -> Validation -> Controller -> SERVICE -> Prisma)
 * USED BY: settings.controller.ts
 * DEPENDS ON: PrismaClient, @meridio/contracts
 */
import type { Currency, SettingsDto, UpdateSettingsInput } from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

const select = { name: true, defaultLowStockThreshold: true, currency: true } as const;

export function createSettingsService(prisma: PrismaClient) {
  const toDto = (o: {
    name: string;
    defaultLowStockThreshold: number;
    currency: string;
  }): SettingsDto => ({
    defaultLowStockThreshold: o.defaultLowStockThreshold,
    // Validated against CURRENCIES on every write, so the stored value is always a member.
    currency: o.currency as Currency,
    organizationName: o.name,
  });

  return {
    /** @throws AppError UNAUTHENTICATED if the organization no longer exists */
    async get(organizationId: string): Promise<SettingsDto> {
      // TENANT SCOPE: the organization is the one from the verified session.
      const org = await prisma.organization.findUnique({ where: { id: organizationId }, select });
      if (!org) throw new AppError('UNAUTHENTICATED', 'Organization not found');
      return toDto(org);
    },

    /**
     * Updates the default threshold and, when given, the display currency. Products with no own threshold follow it immediately, because
     * stock status is computed on read, never stored.
     */
    async update(organizationId: string, input: UpdateSettingsInput): Promise<SettingsDto> {
      // TENANT SCOPE: where id = the caller's organization, so no other tenant can be touched.
      const { count } = await prisma.organization.updateMany({
        where: { id: organizationId },
        data: {
          defaultLowStockThreshold: input.defaultLowStockThreshold,
          ...(input.currency ? { currency: input.currency } : {}),
        },
      });
      if (count === 0) throw new AppError('UNAUTHENTICATED', 'Organization not found');
      return this.get(organizationId);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
