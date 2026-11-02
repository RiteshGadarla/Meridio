/**
 * FILE: scripts/check-bundle.d.mts
 * PURPOSE: Type declarations so TypeScript tests can import scripts/check-bundle.mjs.
 */
export const FORBIDDEN: { name: string; pattern: RegExp }[];
export function scanDirectory(dir: string): { file: string; rule: string }[];
