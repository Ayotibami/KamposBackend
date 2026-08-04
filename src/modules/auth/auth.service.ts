import * as accountRepo from '../account/account.repo';
import { hasUnverifiedForAccount as hasUnverifiedIdiotProfile } from '../profile/idiots/repo';
import argon2 from 'argon2';
import { signToken, signRefreshToken, type JwtClaims } from '../../config/jwt';
import { OTPService } from './otp.service';
import { generateOTP } from '../../utils/otp';
import logger from '../../utils/logger';

// Access + refresh share the same identity claims but are two separate
// signed tokens (separate jti each, so one can be revoked independently of
// the other — see token.service.ts).
function issueTokenPair(claims: Omit<JwtClaims, 'iat' | 'exp' | 'jti'>) {
  const accessToken = signToken(claims);
  const refreshToken = signRefreshToken(claims);
  return { accessToken, refreshToken };
}

export const AuthService = {
  register: async (email: string, password: string) => {
    const existing = await accountRepo.findAccountByEmail(email);
    if (existing) {
      throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
    }
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const account = await accountRepo.createAccountEmail(email, password_hash);
    // Send OTP for verification
    const code = generateOTP();
    await OTPService.send(email, code);
    const { accessToken, refreshToken } = issueTokenPair({
      account_id: account.account_id,
      is_otp_verified: false,
      role: 'USER',
    });
    return { account, accessToken, refreshToken };
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
    // If not verified, send OTP automatically
    if (!account.is_otp_verified) {
      const code = generateOTP();
      await OTPService.send(email, code);
    }
    // Block login if this account has an unverified IDIOT profile
    if (await hasUnverifiedIdiotProfile(account.account_id)) {
      throw Object.assign(new Error('Your IDIOT profile requires superadmin approval before you can login'), { statusCode: 403 });
    }
    const role = account.who === 'king' ? 'king' : 'USER';
    const { accessToken, refreshToken } = issueTokenPair({
      account_id: account.account_id,
      is_otp_verified: account.is_otp_verified,
      role,
    });
    return { account, accessToken, refreshToken };
  },

  issueTokenForProfile: async (claims: Omit<JwtClaims, 'iat' | 'exp' | 'jti'>) => {
    let isVerified = false;
    if (claims.account_id) {
      const acc = await accountRepo.findAccountById(claims.account_id);
      isVerified = !!acc?.is_otp_verified;
    }
    return issueTokenPair({ ...claims, is_otp_verified: isVerified, role: claims.role ?? 'USER' });
  },
};
