import * as accountRepo from '../account/account.repo';
import { hasUnverifiedForAccount as hasUnverifiedIdiotProfile } from '../profile/idiots/repo';
import argon2 from 'argon2';
import { signToken } from '../../config/jwt';
import { OTPService } from './otp.service';
import { generateOTP } from '../../utils/otp';
import logger from '../../utils/logger';
export const AuthService = {
    register: async (email, password) => {
        const existing = await accountRepo.findAccountByEmail(email);
        if (existing) {
            throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
        }
        const password_hash = await argon2.hash(password, { type: argon2.argon2id });
        const account = await accountRepo.createAccountEmail(email, password_hash);
        // Send OTP for verification
        const code = generateOTP();
        await OTPService.send(email, code);
        const token = signToken({ account_id: account.account_id, is_otp_verified: false, role: 'USER' });
        return { account, token };
    },
    login: async (email, password) => {
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
        const token = signToken({ account_id: account.account_id, is_otp_verified: account.is_otp_verified, role });
        return { account, token };
    },
    issueTokenForProfile: async (claims) => {
        let isVerified = false;
        if (claims.account_id) {
            const acc = await accountRepo.findAccountById(claims.account_id);
            isVerified = !!acc?.is_otp_verified;
        }
        return signToken({ ...claims, is_otp_verified: isVerified, role: claims.role ?? 'USER' });
    },
};
