#!/usr/bin/env node
/**
 * FILE: scripts/smoke-prod.mjs
 * PURPOSE: Smoke test for a DEPLOYED StockFlow (or a production-mode local server). Walks the real
 *          lifecycle over HTTP: readiness, signup, cookie flags, /auth/me, create product,
 *          dashboard, logout, /auth/me returns 401.
 * USAGE:   npm run smoke:prod -- https://your-app.vercel.app
 *          (or BASE_URL=https://your-app.vercel.app node scripts/smoke-prod.mjs)
 * NOTES:   - It creates ONE throwaway user + organization + product per run (random email). It does
 *            not delete them; on a production database this is a few harmless rows.
 *          - Unsafe requests send an Origin header equal to the base URL, exactly like a browser on
 *            that site, so APP_ORIGIN must be that same URL.
 *          - Exits 0 on success, 1 on any failure.
 */
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/**
 * Runs the smoke test.
 * @param {string} baseUrl site root, for example https://stockflow.vercel.app (no trailing path)
 * @param {{ origin?: string, log?: (line: string) => void }} [options]
 * @returns {Promise<{ steps: string[] }>} the names of the steps that passed
 * @throws {Error} on the first failed check
 */
export async function runSmoke(baseUrl, options = {}) {
  const base = baseUrl.replace(/\/+$/, '');
  const origin = options.origin ?? new URL(base).origin;
  const log = options.log ?? (() => {});
  const steps = [];
  let cookie = '';

  const check = (name, condition, detail = '') => {
    if (!condition) throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
    steps.push(name);
    log(`ok   ${name}`);
  };

  async function call(method, path, body) {
    const response = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { Origin: origin }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      // non-JSON body (for example an HTML error page from a proxy); json stays null
    }
    return { response, json };
  }

  // 1. Readiness: API is up AND the database answers.
  const ready = await call('GET', '/health/ready');
  check(
    'GET /health/ready is 200',
    ready.response.status === 200,
    `status ${ready.response.status}`,
  );

  // 2. Signup with a random user.
  const id = randomBytes(5).toString('hex');
  const email = `smoke+${id}@example.com`;
  const signup = await call('POST', '/auth/signup', {
    email,
    password: `Smoke-${id}-9a`,
    organizationName: `Smoke ${id}`,
  });
  check(
    'POST /auth/signup is 201',
    signup.response.status === 201,
    `status ${signup.response.status} ${JSON.stringify(signup.json)}`,
  );
  check(
    'signup response has no passwordHash',
    !JSON.stringify(signup.json).includes('passwordHash'),
  );

  // 3. Cookie flags.
  const setCookies = signup.response.headers.getSetCookie();
  const session = setCookies.find((c) => c.startsWith('sf_session='));
  check('sf_session cookie is set', Boolean(session));
  check('cookie is HttpOnly', /;\s*HttpOnly/i.test(session ?? ''));
  check('cookie is Secure', /;\s*Secure/i.test(session ?? ''));
  check('cookie is SameSite=Lax', /;\s*SameSite=Lax/i.test(session ?? ''));
  cookie = (session ?? '').split(';')[0];

  // 4. Session works.
  const me = await call('GET', '/auth/me');
  check(
    'GET /auth/me is 200 with the signed-in user',
    me.response.status === 200 && me.json?.data?.email === email,
  );

  // 5. Create a product, then see it on the dashboard.
  const product = await call('POST', '/products', {
    name: 'Smoke Widget',
    sku: `SMK-${id}`,
    quantityOnHand: 3,
  });
  check(
    'POST /products is 201',
    product.response.status === 201,
    `status ${product.response.status}`,
  );
  const dashboard = await call('GET', '/dashboard/overview');
  check(
    'dashboard shows the new product',
    dashboard.response.status === 200 &&
      dashboard.json?.data?.totalProducts === 1 &&
      dashboard.json?.data?.totalUnits === 3,
  );

  // 6. Logout, then the session is gone.
  const logout = await call('POST', '/auth/logout');
  check('POST /auth/logout is 200', logout.response.status === 200);
  cookie = ''; // a browser drops the cleared cookie
  const after = await call('GET', '/auth/me');
  check('GET /auth/me is 401 after logout', after.response.status === 401);

  return { steps };
}

// ===== CLI =====
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const baseUrl = process.argv[2] ?? process.env.BASE_URL;
  if (!baseUrl) {
    console.error('Usage: npm run smoke:prod -- https://your-app.vercel.app');
    process.exit(1);
  }
  console.log(`Smoke testing ${baseUrl}\n`);
  runSmoke(baseUrl, { log: (line) => console.log(line) })
    .then(({ steps }) => console.log(`\nAll ${steps.length} checks passed.`))
    .catch((error) => {
      console.error(`\n${error.message}`);
      process.exit(1);
    });
}
