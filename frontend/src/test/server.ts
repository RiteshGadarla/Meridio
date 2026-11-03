/**
 * FILE: frontend/src/test/server.ts
 * PURPOSE: Shared MSW server for frontend tests. Unhandled requests fail the test.
 * LAYER: Test support
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Default handler: the sidebar activity feed is on every authenticated page, so tests that do not
// care about it still get an empty feed instead of an unhandled-request failure.
export const server = setupServer(
  http.get('*/api/v1/activity', () =>
    HttpResponse.json({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
  ),
);
