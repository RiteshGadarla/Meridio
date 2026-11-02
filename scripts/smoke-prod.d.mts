/**
 * FILE: scripts/smoke-prod.d.mts
 * PURPOSE: Type declarations so TypeScript tests can import scripts/smoke-prod.mjs.
 */
export function runSmoke(
  baseUrl: string,
  options?: { origin?: string; log?: (line: string) => void },
): Promise<{ steps: string[] }>;
