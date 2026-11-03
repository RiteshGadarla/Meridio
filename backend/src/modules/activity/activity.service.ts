/**
 * FILE: backend/src/modules/activity/activity.service.ts
 * PURPOSE: Records and lists the basic activity feed (product created / edited / stock adjusted /
 *          deleted). No HTTP code here.
 * LAYER: Service (Route -> Middleware -> Validation -> Controller -> SERVICE -> Prisma)
 * USED BY: activity.controller.ts (list), products.service.ts (record)
 * DEPENDS ON: PrismaClient, @meridio/contracts
 * NOTES: Every query MUST include organizationId (tenant isolation). Recording is best-effort: a
 *        feed failure must never fail the inventory change that already succeeded.
 */
import type {
  ActivityAction,
  ActivityDto,
  ListActivityQuery,
  PaginationMeta,
} from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';

/** Everything needed to write one feed entry. */
export interface ActivityInput {
  organizationId: string;
  userId: string;
  action: ActivityAction;
  productId: string | null;
  productName: string;
  productSku: string;
  summary: string;
  note?: string | undefined;
}

export function createActivityService(prisma: PrismaClient) {
  return {
    /**
     * Writes a feed entry. Never throws, so callers can safely fire it without awaiting.
     * EDGE CASE: swallowed on purpose; the product change is already committed and the user must
     * not see an error for a missing feed line.
     */
    async record(input: ActivityInput): Promise<void> {
      try {
        await prisma.activityLog.create({
          data: { ...input, note: input.note ?? null }, // TENANT SCOPE: organizationId from the session
        });
      } catch {
        // intentionally ignored (see above)
      }
    },

    /**
     * Newest-first page of entries for one organization, optionally filtered by action and by
     * product name/SKU.
     */
    async list(
      organizationId: string,
      query: ListActivityQuery,
    ): Promise<{ entries: ActivityDto[]; meta: PaginationMeta }> {
      const { page, limit, action, search } = query;
      const where = {
        organizationId, // TENANT SCOPE
        ...(action ? { action } : {}),
        ...(search
          ? {
              OR: [
                { productName: { contains: search, mode: 'insensitive' as const } },
                { productSku: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          // WHY id as a tie-breaker: entries written in the same millisecond must not swap pages.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.activityLog.count({ where }),
      ]);
      const entries = rows.map((r) => ({
        id: r.id,
        action: r.action,
        productName: r.productName,
        productSku: r.productSku,
        summary: r.summary,
        note: r.note,
        actorName: r.user?.name ?? r.user?.email ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
      return { entries, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
