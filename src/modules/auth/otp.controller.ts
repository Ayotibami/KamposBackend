import type { Request, Response } from 'express';
import { OTPService } from './otp.service';
import { generateOTP } from '../../utils/otp';
import * as accountRepo from '../account/account.repo';
import { safeErrorMessage, safeErrorStatus } from '../../utils/errors';

export const OTPController = {
  send: async (req: Request, res: Response) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });
    // Do not send OTP if already verified (to save costs)
    const acc = await accountRepo.findAccountByEmail(email);
    if (acc?.is_otp_verified) {
      return res.json({ success: true, message: 'Email already verified' });
    }
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
      return res.status(safeErrorStatus(err, 400)).json({ success: false, message: safeErrorMessage(err, 'Invalid code') });
    }
  },
};
