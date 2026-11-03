/**
 * FILE: packages/contracts/src/activity.ts
 * PURPOSE: Schemas and DTO for the basic activity feed shown in the sidebar.
 * LAYER: Shared contract
 * USED BY: backend activity module, frontend sidebar feed
 * NOTES: A feed of recent changes, not an audit trail: entries are short sentences, newest first.
 */
import { z } from 'zod';

export const ACTIVITY_ACTIONS = [
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'STOCK_ADJUSTED',
  'PRODUCT_DELETED',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Query params for GET /activity: server-side paging plus optional action and product filters. */
export const listActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  /** Only entries of this kind. */
  action: z.enum(ACTIVITY_ACTIONS).optional(),
  /** Case-insensitive match on product name or SKU. */
  search: z.string().trim().max(100).optional(),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

/** One feed entry as returned by the API. */
export interface ActivityDto {
  id: string;
  action: ActivityAction;
  productName: string;
  productSku: string;
  /** Ready-to-display sentence, for example "Adjusted stock by -5 (12 → 7)". */
  summary: string;
  /** Optional note typed in the "Adjust stock" dialog. */
  note: string | null;
  /** Display name (or email) of who did it; null if that user was removed. */
  actorName: string | null;
  createdAt: string;
}
