import type { Request, Response } from 'express';
import { PasswordResetService } from './password-reset.service';

export const PasswordResetController = {
  request: async (req: Request, res: Response) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });
    await PasswordResetService.request(email);
    return res.json({ success: true, message: 'If the email exists, a reset token has been sent' });
  },

  reset: async (req: Request, res: Response) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'token and newPassword are required' });
    }
    try {
      await PasswordResetService.reset(token, newPassword);
      return res.json({ success: true, message: 'Password reset successful' });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err.message || 'Reset failed' });
    }
  },
};
