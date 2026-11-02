/**
 * FILE: packages/contracts/src/auth.ts
 * PURPOSE: Zod schemas and DTO types for signup, login and the authenticated user.
 * LAYER: Shared contract
 * USED BY: backend auth module (validation), frontend auth forms (Stage 7)
 * DEPENDS ON: zod
 * NOTES: SECURITY: the password rules live here once. The API enforces them; the UI reuses them
 *        for instant feedback, so the two can never disagree.
 */
import { z } from 'zod';
import type { Currency } from './settings.js';

// ===== Field rules =====

/** Trimmed, lowercased, max 254 chars (the practical limit of an email address). */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email must be at most 254 characters')
  .pipe(z.email('Enter a valid email address'));

/**
 * 8 to 72 characters with at least one letter and one number.
 * WHY 72: bcrypt silently ignores bytes beyond 72, so a longer password would be weaker than the
 * user believes. The byte check also catches multi-byte characters (emoji) that fit in 72 chars
 * but not in 72 bytes.
 */
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

// ===== Schemas =====

/** Request body of POST /auth/signup (what the API validates). */
export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
  organizationName: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(80, 'Organization name must be at most 80 characters'),
});

/**
 * Signup FORM schema: the API schema plus a confirmPassword match check.
 * WHY separate: confirmation is a typing aid for the browser; the API never needs it.
 */
export const signupFormSchema = signupSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/**
 * Request body of POST /auth/google/complete: the second step of Google signup, where a brand-new
 * Google user names their organization. Reuses the signup rule so the two never disagree.
 */
export const googleCompleteSchema = signupSchema.pick({ organizationName: true });

/**
 * Request body of POST /auth/login.
 * EDGE CASE: only "non-empty" is checked for the password, so an old weak password can still log in.
 */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

// ===== Avatar =====

/** Symbols an organization avatar can show. The web app maps each name to an icon. */
export const AVATAR_SYMBOLS = [
  'boxes',
  'package',
  'warehouse',
  'store',
  'factory',
  'layers',
  'container',
  'shopping-bag',
] as const;

export type AvatarSymbol = (typeof AVATAR_SYMBOLS)[number];

/**
 * Stored look of an avatar tile, chosen once when the account/organization is created so it never
 * changes later. `null` (older rows) renders as white-on-black.
 */
export interface AvatarStyle {
  /** CSS colour, e.g. "hsl(210 62% 42%)". */
  from: string;
  to: string;
  /** Gradient angle in degrees. */
  angle: number;
  symbol: AvatarSymbol;
}

// ===== Types =====

export type SignupInput = z.infer<typeof signupSchema>;
export type SignupFormInput = z.infer<typeof signupFormSchema>;
export type GoogleCompleteInput = z.infer<typeof googleCompleteSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** The signed-in user and their organization, as returned by signup, login and /auth/me. */
export interface AuthUser {
  id: string;
  email: string;
  /** Display name from Google; null for password accounts. */
  name: string | null;
  /** Avatar URL from Google; null for password accounts. */
  pictureUrl: string | null;
  /** Gradient look of the user's initial tile; null renders white-on-black. */
  avatar: AvatarStyle | null;
  organization: {
    id: string;
    name: string;
    defaultLowStockThreshold: number;
    /** Display currency for money values. */
    currency: Currency;
    /** Gradient + symbol of the organization tile; null renders white-on-black. */
    avatar: AvatarStyle | null;
  };
}

/**
 * What the API knows about a Google user who has authenticated but not yet created an organization
 * (GET /auth/google/pending). Lets the "name your organization" page greet them.
 */
export interface GooglePendingProfile {
  email: string;
  name: string | null;
  pictureUrl: string | null;
}
