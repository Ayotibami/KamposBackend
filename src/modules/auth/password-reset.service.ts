import * as accountRepo from '../account/account.repo';
import * as prRepo from './password-reset.repo';
import argon2 from 'argon2';
import { sendMail } from '../../config/mail';

export const PasswordResetService = {
  async request(email: string) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) {
      // Do not reveal existence; act as if email sent
      return { requested: true };
    }
    const token = await prRepo.createResetToken(account.account_id, 3600);
    await sendMail({
      to: email,
      subject: 'Reset your Kampos password',
      text: `Use this token to reset your password: ${token.token}. It expires in 1 hour.`,
    });
    return { requested: true };
  },

  async reset(token: string, newPassword: string) {
    const found = await prRepo.findValidToken(token);
    if (!found) {
      throw Object.assign(new Error('Invalid or expired token'), { statusCode: 400 });
    }
    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await accountRepo.updatePasswordHash(found.account_id, hash);
    await prRepo.consumeToken(token);
    return { reset: true };
  },
};
