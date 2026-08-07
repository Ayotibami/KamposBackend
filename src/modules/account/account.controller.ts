import type { Request, Response } from 'express';
import { AccountService } from './account.service';

export const AccountController = {
  me: async (req: Request, res: Response) => {
    if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const data = await AccountService.me(req.user.account_id);
    if (!data) return res.status(404).json({ success: false, message: 'Account not found' });
    // The session's currently-active profile (set via /auth/switch-profile,
    // baked into the JWT) — distinct from `profiles`, which is every
    // profile the account owns regardless of which one (if any) is active
    // right now. Lets the client tell "has a profile" apart from "has an
    // active one", instead of assuming the two always match.
    return res.json({
      success: true,
      data: { ...data, avitag: req.user.avitag ?? null, profileType: req.user.profileType ?? null },
    });
  },

  update: async (req: Request, res: Response) => {
    if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { email } = req.body || {};
    const updated = await AccountService.update(req.user.account_id, { email: email ?? null });
    return res.json({ success: true, data: updated });
  },

  changePassword: async (req: Request, res: Response) => {
    if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    }
    await AccountService.changePassword(req.user.account_id, currentPassword, newPassword);
    return res.json({ success: true, message: 'Password changed' });
  },

  delete: async (req: Request, res: Response) => {
    if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await AccountService.softDelete(req.user.account_id);
    return res.json({ success: true, message: 'Account deleted' });
  },
};
