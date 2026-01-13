import * as otpRepo from './otp.repo';
import * as accountRepo from '../account/account.repo';
import { sendOTPEmail } from '../../services/email/email.service';
import logger from '../../utils/logger';
import { env } from '../../config/env';
export const OTPService = {
    async send(email, code) {
        const otp = await otpRepo.createOTP(email, code, 600);
        try {
            if (env.BREVO_PASSWORD) {
                await sendOTPEmail(email, code, 10);
            }
            else {
                // No email config: log OTP for dev convenience
                logger.warn({ email, code }, 'OTP (dev): Email config missing, logging code');
            }
        }
        catch (e) {
            // Email failures should not break the auth flow; also log OTP in dev
            logger.warn({ email, code, err: e }, 'OTP email failed; logging code for dev');
        }
        return otp;
    },
    async verify(email, code) {
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
