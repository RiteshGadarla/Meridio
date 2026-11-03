/**
 * FILE: backend/src/app.ts
 * PURPOSE: Builds the Express application with the full middleware stack. Does NOT call listen().
 * LAYER: Composition root (Route -> Middleware -> Validation -> Controller -> Service -> Prisma)
 * USED BY: server.ts, tests (Supertest)
 * DEPENDS ON: express, helmet, cors, cookie-parser, pino-http, all middleware, health + auth + products + dashboard + settings modules
 * NOTES: WHY no listen(): tests import createApp() and exercise it without opening a port.
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { loadEnv, type Env } from './config/env.js';
import { createGoogleOAuthClient, type GoogleOAuthClient } from './lib/google-oauth.js';
import { createJwtService } from './lib/jwt.js';
import { createLogger } from './lib/logger.js';
import { prisma as defaultPrisma } from './lib/prisma.js';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  DEFAULT_RATE_LIMITS,
  createRateLimiters,
  type RateLimitConfig,
} from './middleware/rate-limit.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { cacheControl } from './middleware/cache-control.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { originCheck } from './middleware/origin-check.js';
import { requestId } from './middleware/request-id.js';
import { createHealthRouter, type DatabaseCheck } from './modules/health/health.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { createActivityRouter } from './modules/activity/index.js';
import { createProductsRouter } from './modules/products/index.js';

/** Options mainly used by tests; production calls createApp() with no arguments. */
export interface CreateAppOptions {
  /** Validated config. Defaults to loading process.env. */
  env?: Env;
  /** Database probe used by /health/ready. Defaults to SELECT 1 through Prisma. */
  checkDatabase?: DatabaseCheck;
  /** Database client. Defaults to the shared one; tests inject a client bound to the test DB. */
  prisma?: PrismaClient;
  /** Auth rate limits. Defaults: on, except when NODE_ENV=test (so unrelated tests never trip them). */
  rateLimits?: RateLimitConfig;
  /** Google client. Defaults to one built from GOOGLE_* env (null if unset); tests inject a fake. */
  googleClient?: GoogleOAuthClient | null;
  /** TEST SEAM: lets a test mount extra routes inside the real middleware stack. */
  mountRoutes?: (router: Router) => void;
}

/**
 * Creates a fresh Express app with every route mounted under /api/v1.
 * @returns configured Express application
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const env = options.env ?? loadEnv();
  const logger = createLogger(env);
  const app = express();

  // SECURITY: how many proxy hops to trust when deriving req.ip (see TRUST_PROXY_HOPS in env.ts).
  // Rate limiting depends on it being the real visitor address.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  // ===== Global middleware (order matters) =====
  app.use(requestId); // first, so every log line and error has an id
  app.use(helmet());
  app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => String(req.id),
      // WHY: the health endpoints are polled constantly; logging them drowns real traffic.
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
    }),
  );

  // ===== API router, mounted under /api/v1 =====
  const api = Router();
  api.use(originCheck(env.APP_ORIGIN)); // SECURITY: before the body is parsed
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(cacheControl);

  api.use('/health', createHealthRouter(options.checkDatabase));
  const jwt = createJwtService({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN });
  const limiters = createRateLimiters(
    options.rateLimits ?? { ...DEFAULT_RATE_LIMITS, enabled: env.NODE_ENV !== 'test' },
  );
  api.use(
    '/auth',
    createAuthRouter({
      prisma: options.prisma ?? defaultPrisma,
      jwt,
      isProduction: env.NODE_ENV === 'production',
      google:
        options.googleClient !== undefined
          ? options.googleClient
          : createGoogleOAuthClient({
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              redirectUri:
                env.GOOGLE_REDIRECT_URI ?? `${env.APP_ORIGIN}/api/v1/auth/google/callback`,
            }),
      jwtSecret: env.JWT_SECRET,
      appOrigin: env.APP_ORIGIN,
      limiters,
    }),
  );
  api.use(
    '/products',
    createProductsRouter({
      prisma: options.prisma ?? defaultPrisma,
      jwt,
    }),
  );
  const protectedDeps = { prisma: options.prisma ?? defaultPrisma, jwt };
  api.use('/dashboard', createDashboardRouter(protectedDeps));
  api.use('/activity', createActivityRouter(protectedDeps));
  api.use('/settings', createSettingsRouter(protectedDeps));
  options.mountRoutes?.(api);

  app.use('/api/v1', api);

  // ===== Terminal handlers =====
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
