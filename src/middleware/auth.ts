import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';

export function isAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const token = auth.slice('Bearer '.length);
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
