/**
 * FILE: frontend/src/test/server.ts
 * PURPOSE: Shared MSW server for frontend tests. Unhandled requests fail the test.
 * LAYER: Test support
 */
import { setupServer } from 'msw/node';

export const server = setupServer();
