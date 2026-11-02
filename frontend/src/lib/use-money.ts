/**
 * FILE: frontend/src/lib/use-money.ts
 * PURPOSE: Hook returning a money formatter bound to the signed-in organization's currency.
 * LAYER: Frontend infrastructure
 * USED BY: features/products/product-table.tsx, features/dashboard/product-info-dialog.tsx
 * DEPENDS ON: features/auth/hooks.ts (current user), lib/format.ts
 * NOTES: Falls back to the default currency (INR) until the session is loaded.
 */
import { useCurrentUser } from '../features/auth/hooks';
import { formatCurrency } from './format';

/** @example const money = useMoney(); money('1234.5') // "₹1,234.50" */
export function useMoney(): (value: string | number | null | undefined) => string {
  const { data: user } = useCurrentUser();
  const currency = user?.organization.currency;
  return (value) => formatCurrency(value, currency);
}
