/**
 * FILE: backend/src/modules/auth/auth.service.ts
 * PURPOSE: Business logic for signup, login and loading the current user. No HTTP code here.
 * LAYER: Service (Route -> Middleware -> Validation -> Controller -> SERVICE -> Prisma)
 * USED BY: auth.controller.ts
 * DEPENDS ON: PrismaClient, lib/password.ts, @meridio/contracts
 * NOTES: Never returns passwordHash: every public method maps rows to AuthUser.
 */
import type { AuthUser, AvatarStyle, Currency, LoginInput, SignupInput } from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { generateAvatar } from '../../lib/avatar.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { AppError } from '../../utils/app-error.js';

/** Single message for every login failure. SECURITY: prevents telling "no such email" from "bad password". */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

interface UserWithOrg {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  avatar: unknown;
  organization: {
    id: string;
    name: string;
    defaultLowStockThreshold: number;
    currency: string;
    avatar: unknown;
  };
}

/** Maps a DB row to the public shape; the only place a user leaves the service. */
function toAuthUser(row: UserWithOrg): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    pictureUrl: row.pictureUrl,
    avatar: row.avatar as AvatarStyle | null,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      defaultLowStockThreshold: row.organization.defaultLowStockThreshold,
      currency: row.organization.currency as Currency,
      avatar: row.organization.avatar as AvatarStyle | null,
    },
  };
}

const orgSelect = {
  select: { id: true, name: true, defaultLowStockThreshold: true, currency: true, avatar: true },
} as const;
const userSelect = {
  id: true,
  email: true,
  name: true,
  pictureUrl: true,
  avatar: true,
  organization: orgSelect,
} as const;

/** Verified Google facts needed to find or create a user. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

type SessionResult = { user: AuthUser; token: { sub: string; org: string } };

export function createAuthService(prisma: PrismaClient) {
  // SECURITY: compared against when the email is unknown so the response time looks the same as
  // for a real user. Built lazily (one bcrypt hash) and memoised.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password-0'));

  return {
    /**
     * Creates an organization and its owner in ONE transaction.
     * @throws AppError EMAIL_TAKEN (via the P2002 mapping in the error handler) on duplicate email
     * BUSINESS RULE: exactly one user per organization in the MVP.
     * EDGE CASE: if the user insert fails, the transaction rolls back and no orphan org remains.
     */
    async signup(
      input: SignupInput,
    ): Promise<{ user: AuthUser; token: { sub: string; org: string } }> {
      const passwordHash = await hashPassword(input.password); // outside the tx: keep it short
      const user = await prisma.$transaction(
        async (tx) => {
          const organization = await tx.organization.create({
            data: { name: input.organizationName, avatar: { ...generateAvatar() } },
          });
          return tx.user.create({
            // email is already lowercased and trimmed by signupSchema
            data: {
              email: input.email,
              passwordHash,
              organizationId: organization.id,
              avatar: { ...generateAvatar() },
            },
            select: userSelect,
          });
        },
        // WHY explicit limits: Prisma defaults (2s to get a connection, 5s to finish) are too tight
        // for Neon, whose compute can take a few seconds to wake after idling. A timeout here would
        // surface as a 500 on an otherwise valid signup.
        { maxWait: 10_000, timeout: 15_000 },
      );
      return { user: toAuthUser(user), token: { sub: user.id, org: user.organization.id } };
    },

    /**
     * Verifies credentials.
     * @throws AppError UNAUTHENTICATED with a generic message for unknown email AND wrong password
     */
    async login(
      input: LoginInput,
    ): Promise<{ user: AuthUser; token: { sub: string; org: string } }> {
      const row = await prisma.user.findUnique({
        where: { email: input.email },
        select: { ...userSelect, passwordHash: true },
      });
      const valid = await verifyPassword(
        input.password,
        // Google-only accounts have no hash: compare against the dummy so they simply fail.
        row?.passwordHash ?? (await getDummyHash()),
      );
      if (!row || !valid) throw new AppError('UNAUTHENTICATED', INVALID_CREDENTIALS_MESSAGE);
      return { user: toAuthUser(row), token: { sub: row.id, org: row.organization.id } };
    },

    /**
     * Signs in a Google user who already has an account.
     * @returns the session, or null when this is a brand-new person (the caller then asks for an
     *          organization name and calls completeGoogleSignup).
     * SECURITY: the caller must only pass identities whose email Google marked verified. An
     *           existing password account with the same email is linked, which is safe only
     *           because Google proved ownership of that address.
     * EDGE CASE: name and picture are refreshed from Google on every login so they stay current.
     */
    async loginWithGoogle(identity: GoogleIdentity): Promise<SessionResult | null> {
      const existing =
        (await prisma.user.findUnique({
          where: { googleId: identity.sub },
          select: { id: true },
        })) ??
        (await prisma.user.findUnique({ where: { email: identity.email }, select: { id: true } }));
      if (!existing) return null;
      const row = await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: identity.sub,
          name: identity.name,
          pictureUrl: identity.pictureUrl,
        },
        select: userSelect,
      });
      return { user: toAuthUser(row), token: { sub: row.id, org: row.organization.id } };
    },

    /**
     * Second step of Google signup: creates the organization and the password-less owner.
     * @throws AppError EMAIL_TAKEN (P2002 mapping) if the email or Google id was registered meanwhile
     * BUSINESS RULE: same as signup, exactly one user per organization.
     */
    async completeGoogleSignup(
      identity: GoogleIdentity,
      organizationName: string,
    ): Promise<SessionResult> {
      const user = await prisma.$transaction(
        async (tx) => {
          const organization = await tx.organization.create({
            data: { name: organizationName, avatar: { ...generateAvatar() } },
          });
          return tx.user.create({
            data: {
              email: identity.email,
              googleId: identity.sub,
              name: identity.name,
              pictureUrl: identity.pictureUrl,
              avatar: { ...generateAvatar() },
              organizationId: organization.id,
            },
            select: userSelect,
          });
        },
        { maxWait: 10_000, timeout: 15_000 },
      );
      return { user: toAuthUser(user), token: { sub: user.id, org: user.organization.id } };
    },

    /**
     * Loads the signed-in user with FRESH organization data (so a changed threshold shows at once).
     * @throws AppError UNAUTHENTICATED if the user no longer exists
     */
    async getCurrentUser(userId: string): Promise<AuthUser> {
      const row = await prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
      });
      if (!row) throw new AppError('UNAUTHENTICATED', 'Authentication required');
      return toAuthUser(row);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
