/**
 * FILE: frontend/src/features/auth/api.ts
 * PURPOSE: Typed calls to the /auth endpoints.
 * LAYER: Feature API
 * USED BY: features/auth/hooks.ts
 * DEPENDS ON: lib/api-client.ts, @meridio/contracts
 */
import type {
  AuthUser,
  GoogleCompleteInput,
  GooglePendingProfile,
  LoginInput,
  SignupInput,
} from '@meridio/contracts';
import { ApiError, api } from '../../lib/api-client';

/** SECURITY: credentials go in the POST body over the same-origin /api proxy, never in a URL. */
export const signup = (input: SignupInput) =>
  api.post<AuthUser>('/auth/signup', input, { skipUnauthorizedHandler: true });

// WHY skipUnauthorizedHandler: a 401 on login means "wrong password", not "session expired".
export const login = (input: LoginInput) =>
  api.post<AuthUser>('/auth/login', input, { skipUnauthorizedHandler: true });

export const logout = () => api.post<{ loggedOut: boolean }>('/auth/logout');

/**
 * Loads the signed-in user.
 * @returns the user, or null when nobody is signed in (a normal state, not an error)
 * @throws ApiError for anything other than 401 (network failure, 500)
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    return await api.get<AuthUser>('/auth/me', { skipUnauthorizedHandler: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Where the browser is sent to start Google sign-in (a full-page navigation, not an XHR). */
export const GOOGLE_START_URL = '/api/v1/auth/google';

/** Who the half-signed-up Google user is. A 401 means the 10-minute pending cookie expired. */
export const fetchGooglePending = () =>
  api.get<GooglePendingProfile>('/auth/google/pending', { skipUnauthorizedHandler: true });

export const completeGoogleSignup = (input: GoogleCompleteInput) =>
  api.post<AuthUser>('/auth/google/complete', input, { skipUnauthorizedHandler: true });
