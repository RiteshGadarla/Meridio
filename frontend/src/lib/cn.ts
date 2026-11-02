/**
 * FILE: frontend/src/lib/cn.ts
 * PURPOSE: Joins class names, skipping falsy values.
 * LAYER: Utility
 * USED BY: every component
 */
export type ClassValue = string | false | null | undefined;

/** @example cn('px-2', isActive && 'bg-forest') // "px-2 bg-forest" or "px-2" */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
