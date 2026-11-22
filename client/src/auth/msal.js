import { PublicClientApplication } from '@azure/msal-browser';

// Single-tenant SPA, Authorization Code + PKCE. No secret in the browser.
// Uses full-page redirect (not popup): popups break when the redirect page loads the whole app.
export const msal = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: { cacheLocation: 'sessionStorage' },
});

export const loginRequest = { scopes: ['openid', 'profile', 'email'], prompt: 'select_account' };

let ready;
/** Initialise MSAL once and process the redirect response (if we just came back from Microsoft). */
export function msalReady() {
  if (!import.meta.env.VITE_ENTRA_CLIENT_ID || !import.meta.env.VITE_ENTRA_TENANT_ID) {
    return Promise.reject(new Error('Microsoft sign-in is not configured (client/.env missing). Restart npm run dev after adding it.'));
  }
  ready ??= msal.initialize().then(() => msal.handleRedirectPromise());
  return ready;
}