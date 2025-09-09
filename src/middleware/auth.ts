import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import { isRevoked } from '../modules/auth/token.service';

export async function isAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const token = auth.slice('Bearer '.length);
    const payload = verifyToken(token);
    // Check revocation list
    const revoked = await isRevoked(payload.jti);
    if (revoked) {
      return res.status(401).json({ success: false, message: 'Token revoked' });
    }
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
