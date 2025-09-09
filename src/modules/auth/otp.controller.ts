import type { Request, Response } from 'express';
import { OTPService } from './otp.service';
import { generateOTP } from '../../utils/otp';

export const OTPController = {
  send: async (req: Request, res: Response) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });
    const code = generateOTP();
    await OTPService.send(email, code);
    return res.json({ success: true, message: 'OTP sent' });
  },

  verify: async (req: Request, res: Response) => {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ success: false, message: 'email and code are required' });
    try {
      const result = await OTPService.verify(email, code);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err.message || 'Invalid code' });
    }
  },
};
