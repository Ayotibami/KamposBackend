import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import { isRevoked } from '../modules/auth/token.service';
import { ACCESS_COOKIE } from '../utils/authCookies';

// Cookie first (the real path now — httpOnly, set by the server) — the
// Authorization header is kept as a fallback purely for API testing tools
// (Postman/curl) that don't carry cookies, not for the browser app itself.
function extractToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return null;
}

export async function isAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const payload = verifyToken(token);
    // Check revocation list
    const revoked = await isRevoked(payload.jti);
    if (revoked) {
      return res.status(401).json({ success: false, message: 'Token revoked' });
    }
    // King bypass: always pass
    if (payload.who === 'king') {
      req.user = { ...payload, who: 'king', avitag: 'king', profileType: 'king' };
      return next();
    }
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export async function fakeAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    // no token, proceed as anonymous
    return next();
  }
  try {
    const payload = verifyToken(token);
    const revoked = await isRevoked(payload.jti);
    if (!revoked) {
      req.user = payload;
    }
  } catch (_e) {
    // ignore invalid token
  }
  return next();
}
