/**
 * FILE: backend/src/utils/api-response.ts
 * PURPOSE: Sends the standard success envelope { data, meta? }.
 * LAYER: Utility
 * USED BY: controllers
 * DEPENDS ON: @meridio/contracts (ApiSuccess)
 */
import type { Response } from 'express';
import type { ApiSuccess } from '@meridio/contracts';

/**
 * Sends a success response.
 * @param res Express response
 * @param data payload placed under `data`
 * @param meta optional metadata (pagination etc.)
 * @param status HTTP status, default 200
 */
export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200): void {
  const body: ApiSuccess<T> = meta ? { data, meta } : { data };
  res.status(status).json(body);
}
