/**
 * FILE: backend/src/middleware/request-id.ts
 * PURPOSE: Gives every request an id, echoes it in x-request-id and exposes it as req.id.
 * LAYER: Middleware (runs first so every log line and error carries the id)
 * USED BY: app.ts, pino-http (genReqId)
 * NOTES: An inbound x-request-id is honoured so a request can be traced across Vercel and Render,
 *        but only if it is short and boring: SECURITY: this value ends up in logs and headers.
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Reads a safe inbound request id or generates a fresh UUID. */
export function resolveRequestId(inbound: string | string[] | undefined): string {
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
  return candidate && SAFE_ID.test(candidate) ? candidate : randomUUID();
}

export const requestId: RequestHandler = (req, res, next) => {
  const id = resolveRequestId(req.headers['x-request-id']);
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};
