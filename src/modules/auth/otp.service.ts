import * as otpRepo from './otp.repo';
import * as accountRepo from '../account/account.repo';
import { sendMail } from '../../config/mail';

export const OTPService = {
  async send(email: string, code: string) {
    const otp = await otpRepo.createOTP(email, code, 600);
    await sendMail({
      to: email,
      subject: 'Your Kampos verification code',
      text: `Your OTP is ${code}. It expires in 10 minutes.`,
    });
    return otp;
  },

  async verify(email: string, code: string) {
    const found = await otpRepo.findValidOTP(email, code);
    if (!found) {
      throw Object.assign(new Error('Invalid or expired code'), { statusCode: 400 });
    }
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) {
      throw Object.assign(new Error('Account not found'), { statusCode: 404 });
    }
    await accountRepo.markOtpVerified(account.account_id);
    await otpRepo.deleteOTP(found.id);
    return { account_id: account.account_id };
  },
};
