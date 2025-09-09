import type { Request, Response, NextFunction } from 'express';

export function isIdiot(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (user.profileType !== 'IDIOT') {
    return res.status(403).json({ success: false, message: 'IDIOT role required' });
  }
  next();
}
