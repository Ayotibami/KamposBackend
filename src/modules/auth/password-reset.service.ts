import * as accountRepo from '../account/account.repo';
import * as otpRepo from './otp.repo';
import { sendPasswordResetEmail } from '../../services/email/email.service';
import { generateOTP } from '../../utils/otp';
import argon2 from 'argon2';

export const PasswordResetService = {
  // Same response regardless of whether the email is actually registered —
  // returning a 404 here (as this used to) lets anyone probe arbitrary
  // emails against this endpoint and learn which ones have accounts on the
  // platform just from the status code, a classic enumeration hole on a
  // "forgot password" flow. Silently skip the OTP creation/email send for a
  // non-existent account instead of telling the caller it doesn't exist.
  async request(email: string) {
    const account = await accountRepo.findAccountByEmail(email);
    if (account) {
      const code = generateOTP();
      await otpRepo.createOTP(email, code, 600);
      try {
        await sendPasswordResetEmail(email, code, 10);
      } catch (_e) {
        // Do not fail the flow if email sending fails; client can request again
      }
    }
    return { requested: true };
  },

  async reset(email: string, code: string, newPassword: string) {
    const account = await accountRepo.findAccountByEmail(email);
    const otp = await otpRepo.findValidOTP(email, code);
    // Same "Invalid or expired code" message whether the account is
    // missing or the code just doesn't match — same enumeration reasoning
    // as request() above.
    if (!account || !otp) {
      throw Object.assign(new Error('Invalid or expired code'), { statusCode: 400 });
    }
    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await accountRepo.updatePasswordHash(account.account_id, hash);
    await otpRepo.deleteOTP(otp.id);
    return { reset: true };
  },
};
