/**
 * FILE: backend/test/api/activity.test.ts
 * PURPOSE: Integration tests for the basic activity feed (GET /activity) and for the product
 *          actions that write to it.
 * LAYER: Test (Supertest + real Neon TEST database)
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp, TEST_ORIGIN } from '../helpers.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function signup(email: string, org: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: 'Passw0rdOK', organizationName: org });
  return (res.headers['set-cookie'] as unknown as string[])
    .find((c) => c.startsWith('sf_session='))!
    .split(';')[0]!;
}

const send = (method: 'post' | 'patch' | 'delete', cookie: string, path: string, body?: object) => {
  const agent = request(app);
  const req = method === 'post' ? agent.post : method === 'patch' ? agent.patch : agent.delete;
  return req
    .call(agent, `/api/v1/products${path}`)
    .set('Origin', TEST_ORIGIN)
    .set('Cookie', cookie)
    .send(body);
};

const feed = (cookie: string, query = '') =>
  request(app).get(`/api/v1/activity${query}`).set('Cookie', cookie);

/**
 * Waits until the feed has `count` entries. WHY: the server writes feed entries in the background
 * after replying, so a read straight after an action may not see them yet.
 */
const settled = (cookie: string, count: number) =>
  vi.waitFor(async () => expect((await feed(cookie)).body.data).toHaveLength(count), {
    timeout: 5000,
  });

// Protects: every product action leaves one readable feed line, newest first.
describe('Activity feed', () => {
  it('records create, edit, stock adjust (with note) and delete, newest first', async () => {
    const cookie = await signup('owner@acme.test', 'Acme');
    const { id } = (
      await send('post', cookie, '', { name: 'Keyboard', sku: 'kb-1', quantityOnHand: 12 })
    ).body.data;
    await send('patch', cookie, `/${id}`, { sellingPrice: 9.5, name: 'Keyboard Pro' });
    await send('patch', cookie, `/${id}/stock`, { delta: -5, note: 'Damaged in transit' });
    await send('delete', cookie, `/${id}`);

    await settled(cookie, 4);
    const res = await feed(cookie);
    expect(res.status).toBe(200);
    const entries = res.body.data as Array<Record<string, unknown>>;
    expect(entries.map((e) => e.action)).toEqual([
      'PRODUCT_DELETED',
      'STOCK_ADJUSTED',
      'PRODUCT_UPDATED',
      'PRODUCT_CREATED',
    ]);
    expect(entries[1]).toMatchObject({
      summary: 'Stock -5 (12 → 7)',
      note: 'Damaged in transit',
      actorName: 'owner@acme.test',
    });
    expect(entries[2]!.summary).toBe('Edited selling price, name');
    // Name and SKU are copied into the entry, so a deleted product still reads correctly.
    expect(entries[0]).toMatchObject({ productName: 'Keyboard Pro', productSku: 'KB-1' });
  });

  it('does not record a failed adjustment', async () => {
    const cookie = await signup('owner@acme.test', 'Acme');
    const { id } = (await send('post', cookie, '', { name: 'A', sku: 'A-1', quantityOnHand: 1 }))
      .body.data;
    await send('patch', cookie, `/${id}/stock`, { delta: -9 });
    await settled(cookie, 1);
    await new Promise((r) => setTimeout(r, 300)); // give a wrongly-queued write time to land
    expect((await feed(cookie)).body.data).toHaveLength(1); // only the create
  });

  it('respects ?limit and rejects an out-of-range limit', async () => {
    const cookie = await signup('owner@acme.test', 'Acme');
    for (const sku of ['A-1', 'A-2', 'A-3']) await send('post', cookie, '', { name: sku, sku });
    await settled(cookie, 3);
    expect((await feed(cookie, '?limit=2')).body.data).toHaveLength(2);
    expect((await feed(cookie, '?limit=500')).status).toBe(400);
  });

  it('pages through entries with meta, and filters by action and by product name or SKU', async () => {
    const cookie = await signup('owner@acme.test', 'Acme');
    const a = (await send('post', cookie, '', { name: 'Keyboard', sku: 'KB-1', quantityOnHand: 5 }))
      .body.data;
    await send('post', cookie, '', { name: 'Mouse', sku: 'MS-1' });
    await send('patch', cookie, `/${a.id}/stock`, { delta: 2 });
    await settled(cookie, 3);

    const page1 = await feed(cookie, '?limit=2&page=1');
    expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page1.body.data).toHaveLength(2);
    expect((await feed(cookie, '?limit=2&page=2')).body.data).toHaveLength(1);

    const adjusts = await feed(cookie, '?action=STOCK_ADJUSTED');
    expect(adjusts.body.meta.total).toBe(1);
    expect(adjusts.body.data[0].productName).toBe('Keyboard');

    expect((await feed(cookie, '?search=mous')).body.data).toHaveLength(1);
    expect((await feed(cookie, '?search=kb-1')).body.data).toHaveLength(2); // create + adjust
    expect((await feed(cookie, '?action=NOPE')).status).toBe(400);
  });

  it("never shows another organization's activity (tenant isolation)", async () => {
    const a = await signup('a@acme.test', 'Acme');
    const b = await signup('b@globex.test', 'Globex');
    await send('post', a, '', { name: 'Secret', sku: 'S-1' });
    await settled(a, 1); // the entry exists for A, so B's empty feed is a real isolation check
    expect((await feed(b)).body.data).toEqual([]);
  });

  it('requires a session', async () => {
    expect((await request(app).get('/api/v1/activity')).status).toBe(401);
  });
});
