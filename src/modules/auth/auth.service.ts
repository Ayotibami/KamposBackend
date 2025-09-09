import * as accountRepo from '../account/account.repo';
import argon2 from 'argon2';
import { signToken, type JwtClaims } from '../../config/jwt';

export const AuthService = {
  register: async (email: string, password: string) => {
    const existing = await accountRepo.findAccountByEmail(email);
    if (existing) {
      throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
    }
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const account = await accountRepo.createAccountEmail(email, password_hash);
    const token = signToken({ account_id: account.account_id });
    return { account, token };
  },

  login: async (email: string, password: string) => {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account || !account.password_hash) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }
    const ok = await argon2.verify(account.password_hash, password);
    if (!ok) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }
    await accountRepo.updateLastLogin(account.account_id);
    const token = signToken({ account_id: account.account_id });
    return { account, token };
  },

  issueTokenForProfile: async (claims: Omit<JwtClaims, 'iat' | 'exp'>) => {
    return signToken(claims);
  },
};
