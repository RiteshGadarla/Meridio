/**
 * FILE: backend/src/lib/google-oauth.ts
 * PURPOSE: Thin client for Google's OAuth 2.0 authorization-code flow: build the consent URL and
 *          trade the returned code for the user's verified profile.
 * LAYER: Lib (infrastructure; no Prisma, no Express)
 * USED BY: modules/auth/auth.routes.ts (via the controller), app.ts (injectable for tests)
 * DEPENDS ON: global fetch (Node 20+)
 * NOTES: SECURITY: the code is exchanged server to server with the client secret, which never
 *        reaches the browser. The profile comes from Google's userinfo endpoint over TLS using the
 *        access token we just received, so there is no id_token to verify by hand.
 */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** The verified facts we use from a Google account. */
export interface GoogleProfile {
  /** Stable Google account id (OIDC `sub`). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  pictureUrl: string | null;
}

export interface GoogleOAuthClient {
  /** URL to send the browser to. `state` is echoed back on the callback (CSRF protection). */
  buildAuthUrl(state: string): string;
  /** @throws if Google rejects the code or the profile is unusable */
  exchangeCode(code: string): Promise<GoogleProfile>;
}

/**
 * Creates the client, or returns null when credentials are not configured.
 * @example const google = createGoogleOAuthClient({ clientId, clientSecret, redirectUri });
 */
export function createGoogleOAuthClient(config: {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri: string;
}): GoogleOAuthClient | null {
  const { clientId, clientSecret, redirectUri } = config;
  if (!clientId || !clientSecret) return null;

  return {
    buildAuthUrl(state) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        // WHY: always show the account chooser, so a shared computer does not silently reuse
        // whichever Google account happens to be signed in.
        prompt: 'select_account',
      });
      return `${AUTH_URL}?${params.toString()}`;
    },

    async exchangeCode(code) {
      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status})`);
      const token = (await tokenRes.json()) as { access_token?: unknown };
      if (typeof token.access_token !== 'string')
        throw new Error('Google returned no access token');

      const infoRes = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!infoRes.ok) throw new Error(`Google userinfo failed (${infoRes.status})`);
      const info = (await infoRes.json()) as Record<string, unknown>;
      if (typeof info.sub !== 'string' || typeof info.email !== 'string') {
        throw new Error('Google profile is missing sub or email');
      }
      return {
        sub: info.sub,
        email: info.email.trim().toLowerCase(),
        emailVerified: info.email_verified === true,
        name: typeof info.name === 'string' && info.name.trim() ? info.name.trim() : null,
        pictureUrl: typeof info.picture === 'string' ? info.picture : null,
      };
    },
  };
}
