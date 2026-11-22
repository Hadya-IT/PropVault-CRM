import { createRemoteJWKSet, jwtVerify } from 'jose';
import { unauthorized } from '../lib/errors.js';

/**
 * Verifies a Microsoft Entra ID token issued to our SPA.
 * Checks signature (tenant JWKS), issuer (our tenant only), audience (our app),
 * expiry, and tenant id. No client secret is involved.
 */
export function createEntraVerifier({ tenantId, clientId }) {
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const jwks = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
    { cooldownDuration: 30_000, cacheMaxAge: 6 * 60 * 60 * 1000 },
  );

  return async function verifyIdToken(idToken) {
    if (typeof idToken !== 'string' || idToken.length > 8000) throw unauthorized('Invalid token');
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, jwks, {
        issuer,
        audience: clientId,
        algorithms: ['RS256'],
        clockTolerance: 60,
      }));
    } catch {
      throw unauthorized('Microsoft sign-in could not be verified');
    }
    if (payload.tid !== tenantId) throw unauthorized('Wrong tenant');
    const email = String(payload.preferred_username || payload.email || '').toLowerCase();
    if (!payload.oid || !email) throw unauthorized('Token is missing user identity');
    return { oid: String(payload.oid), email, name: String(payload.name || email) };
  };
}
