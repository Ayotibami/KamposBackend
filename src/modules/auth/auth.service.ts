import * as accountRepo from '../account/account.repo';
import type { Account } from '../account/account.repo';
import argon2 from 'argon2';
import { signToken, signRefreshToken, type JwtClaims } from '../../config/jwt';
import { OTPService } from './otp.service';
import { generateOTP } from '../../utils/otp';
import logger from '../../utils/logger';

// Thrown by login()/issueTokenForProfile() for a non-ACTIVE account —
// `code` lets the frontend tell these apart from a plain wrong-password
// 401 (and from each other) without parsing message text. See
// auth.controller.ts's login handler, which is the one place that reads
// `code` back off a caught error and forwards it into the JSON response.
function blockedAccountError(account: Pick<Account, 'account_status' | 'account_status_reason'>) {
  if (account.account_status === 'DEACTIVATED') {
    return Object.assign(new Error("You deactivated this account. Want it back? Reactivate and you're good to go."), {
      statusCode: 403,
      code: 'ACCOUNT_DEACTIVATED',
    });
  }
  if (account.account_status === 'SUSPENDED') {
    const reasonSuffix = account.account_status_reason ? ` Reason given: "${account.account_status_reason}"` : '';
    return Object.assign(
      new Error(
        `Your account has been suspended by our team, so we can't let you in right now.${reasonSuffix} If you think this is a mistake, reach out to us at kamposkonnect@gmail.com and we'll sort it with you.`,
      ),
      { statusCode: 403, code: 'ACCOUNT_SUSPENDED' },
    );
  }
  // DELETED
  return Object.assign(
    new Error(
      "This account has been deleted and can't be recovered. If this happened by mistake, reach out to us at kamposkonnect@gmail.com and we'll take a look.",
    ),
    { statusCode: 403, code: 'ACCOUNT_DELETED' },
  );
}

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
      role: 'user',
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
    if (account.account_status !== 'ACTIVE') {
      throw blockedAccountError(account);
    }
    await accountRepo.updateLastLogin(account.account_id);
    // If not verified, send OTP automatically
    if (!account.is_otp_verified) {
      const code = generateOTP();
      await OTPService.send(email, code);
    }
    const { accessToken, refreshToken } = issueTokenPair({
      account_id: account.account_id,
      is_otp_verified: account.is_otp_verified,
      role: account.role,
    });
    return { account, accessToken, refreshToken };
  },

  // Always looks the account's role up fresh from the DB rather than
  // trusting whatever role was passed in via `claims` — this is what
  // prevents role from ever going stale across refresh/switch-profile
  // (e.g. after a king grants/revokes admin, or an old token was minted
  // before a role change).
  issueTokenForProfile: async (claims: Omit<JwtClaims, 'iat' | 'exp' | 'jti'>) => {
    let isVerified = false;
    let role: JwtClaims['role'] = 'user';
    if (claims.account_id) {
      const acc = await accountRepo.findAccountById(claims.account_id);
      // Defense in depth for refresh/switch-profile: the per-account Redis
      // revocation marker (see token.service.ts) is what's meant to catch
      // an account that got suspended/deactivated/deleted mid-session, but
      // this DB round-trip was already happening here anyway (for
      // role/is_otp_verified), so checking status fresh too costs nothing
      // extra and still catches it even if that marker was somehow missed
      // (a brief Redis outage, say).
      if (acc && acc.account_status !== 'ACTIVE') {
        throw blockedAccountError(acc);
      }
      isVerified = !!acc?.is_otp_verified;
      role = acc?.role ?? 'user';
    }
    return issueTokenPair({ ...claims, is_otp_verified: isVerified, role });
  },

  // Re-verifies credentials exactly like login() above, but only succeeds
  // for a DEACTIVATED account — this IS the self-service "turn my account
  // back on" flow (see accountRepo.reactivateAccount). Kept as its own
  // function rather than a login() flag since the two have genuinely
  // different preconditions (login requires ACTIVE, this requires
  // DEACTIVATED) and different side effects (this also flips the status).
  reactivate: async (email: string, password: string) => {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account || !account.password_hash) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }
    const ok = await argon2.verify(account.password_hash, password);
    if (!ok) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }
    if (account.account_status !== 'DEACTIVATED') {
      throw Object.assign(new Error("This account isn't deactivated — nothing to reactivate."), { statusCode: 400 });
    }
    await accountRepo.reactivateAccount(account.account_id);
    await accountRepo.updateLastLogin(account.account_id);
    const { accessToken, refreshToken } = issueTokenPair({
      account_id: account.account_id,
      is_otp_verified: account.is_otp_verified,
      role: account.role,
    });
    return { account: { ...account, account_status: 'ACTIVE' as const }, accessToken, refreshToken };
  },
};
