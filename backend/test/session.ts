/**
 * FILE: backend/test/session.ts
 * PURPOSE: A cookie-keeping API client for scenario tests (acts like one browser session).
 * LAYER: Test support
 * USED BY: test/e2e/*.test.ts
 * NOTES: Every unsafe request carries the allowed Origin header, exactly as a browser on the
 *        frontend origin would send it.
 */
import type { Express } from 'express';
import request from 'supertest';
import { TEST_ORIGIN } from './helpers.js';

const PREFIX = '/api/v1';

/** One independent "browser": its own cookie jar. */
export class ApiSession {
  private readonly agent;
  constructor(app: Express) {
    this.agent = request.agent(app);
  }
  get(path: string) {
    return this.agent.get(`${PREFIX}${path}`);
  }
  post(path: string, body?: object) {
    return this.agent.post(`${PREFIX}${path}`).set('Origin', TEST_ORIGIN).send(body);
  }
  patch(path: string, body?: object) {
    return this.agent.patch(`${PREFIX}${path}`).set('Origin', TEST_ORIGIN).send(body);
  }
  delete(path: string) {
    return this.agent.delete(`${PREFIX}${path}`).set('Origin', TEST_ORIGIN);
  }

  /** Signs up a new organization and owner, leaving this session signed in. */
  async signup(email: string, organizationName: string, password = 'Passw0rdOK') {
    const res = await this.post('/auth/signup', { email, password, organizationName });
    if (res.status !== 201)
      throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data as { id: string; email: string; organization: { id: string } };
  }
}

/** A session with no cookies, for "not signed in" assertions. */
export const anonymous = (app: Express) => new ApiSession(app);
