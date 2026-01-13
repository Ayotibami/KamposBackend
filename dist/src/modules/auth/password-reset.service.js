import * as accountRepo from '../account/account.repo';
import * as otpRepo from './otp.repo';
import { sendPasswordResetEmail } from '../../services/email/email.service';
import { generateOTP } from '../../utils/otp';
import argon2 from 'argon2';
export const PasswordResetService = {
    async request(email) {
        const account = await accountRepo.findAccountByEmail(email);
        if (!account) {
            throw Object.assign(new Error('Account with this email does not exist'), { statusCode: 404 });
        }
        const code = generateOTP();
        await otpRepo.createOTP(email, code, 600);
        try {
            await sendPasswordResetEmail(email, code, 10);
        }
        catch (_e) {
            // Do not fail the flow if email sending fails; client can request again
        }
        return { requested: true };
    },
    async reset(email, code, newPassword) {
        const account = await accountRepo.findAccountByEmail(email);
        if (!account) {
            throw Object.assign(new Error('Account with this email does not exist'), { statusCode: 404 });
        }
        const otp = await otpRepo.findValidOTP(email, code);
        if (!otp) {
            throw Object.assign(new Error('Invalid or expired code'), { statusCode: 400 });
        }
        const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
        await accountRepo.updatePasswordHash(account.account_id, hash);
        await otpRepo.deleteOTP(otp.id);
        return { reset: true };
    },
};
