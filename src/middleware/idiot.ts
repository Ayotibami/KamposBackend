import type { Request, Response, NextFunction } from 'express';

// The single source of truth for "does this account have admin powers" —
// king has at least every power idiot has, everywhere, so this always
// checks both together rather than letting call sites compare against
// 'idiot' alone and accidentally exclude king.
export function isAdminRole(role?: string): boolean {
  return role === 'idiot' || role === 'king';
}

export function isIdiot(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (user.role === 'king' || user.role === 'idiot') return next();
  return res.status(403).json({ success: false, message: 'IDIOT role required' });
}
