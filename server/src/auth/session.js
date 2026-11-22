import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'pv_session';

export function createSessionManager({ secret, ttlMinutes, secure }) {
  const key = new TextEncoder().encode(secret);

  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ttlMinutes * 60 * 1000,
  };

  async function issue(res, userId) {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(userId))
      .setIssuedAt()
      .setIssuer('propvault')
      .setAudience('propvault')
      .setExpirationTime(`${ttlMinutes}m`)
      .sign(key);
    res.cookie(SESSION_COOKIE, token, cookieOptions);
  }

  async function read(req) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: 'propvault',
        audience: 'propvault',
        algorithms: ['HS256'],
      });
      const id = Number(payload.sub);
      return Number.isInteger(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  function clear(res) {
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
  }

  return { issue, read, clear };
}
