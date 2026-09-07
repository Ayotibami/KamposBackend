import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import { isRevoked, isAccountRevoked } from '../modules/auth/token.service';
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
    // Bulk per-account revocation — catches a token that was perfectly
    // valid when issued but whose account got suspended/deactivated/
    // deleted since (see token.service.ts's own doc comment). This is
    // what makes that kind of action bite on the very next request
    // instead of waiting for the access token to naturally expire.
    if (await isAccountRevoked(payload.account_id, payload.iat)) {
      return res.status(401).json({ success: false, message: 'Session revoked' });
    }
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export async function fakeAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    // No token at all — a genuine guest. Proceed anonymous.
    return next();
  }
  try {
    const payload = verifyToken(token);
    const revoked = await isRevoked(payload.jti);
    if (revoked) {
      return res.status(401).json({ success: false, message: 'Token revoked' });
    }
    if (await isAccountRevoked(payload.account_id, payload.iat)) {
      return res.status(401).json({ success: false, message: 'Session revoked' });
    }
    req.user = payload;
    return next();
  } catch (e) {
    // A token WAS sent but failed verification (expired/malformed) — this is
    // a real, logged-in session that just needs a refresh, not a guest.
    // Silently falling through to anonymous here (the old behavior) meant
    // viewer-scoped endpoints like the gist feed would quietly serve the
    // unscoped/guest-visible result with no viewer identity attached, and
    // the frontend's axios interceptor — which only refreshes+retries on a
    // 401 — never got a signal that anything was wrong. Returning 401 here
    // routes this through that same self-healing refresh-and-retry path
    // every isAuth-protected endpoint already gets, instead of silently
    // downgrading a real session to a guest one for this one request.
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
