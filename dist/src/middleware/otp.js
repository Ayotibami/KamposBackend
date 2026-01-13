import * as accountRepo from '../modules/account/account.repo';
import { OTPService } from '../modules/auth/otp.service';
import { generateOTP } from '../utils/otp';
// Require that the authenticated account has verified OTP
// If not verified, send a fresh OTP and block the request with 403
export async function requireOtpVerified(req, res, next) {
    try {
        const user = req.user;
        if (!user?.account_id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        // Quick token hint
        if (user.is_otp_verified)
            return next();
        // Fetch latest account state
        const account = await accountRepo.findAccountById(user.account_id);
        if (account?.is_otp_verified)
            return next();
        // Not verified: issue OTP and block
        if (account?.email) {
            const code = generateOTP();
            await OTPService.send(account.email, code);
        }
        return res.status(403).json({ success: false, message: 'OTP verification required. A new code has been sent to your email.' });
    }
    catch (err) {
        return res.status(403).json({ success: false, message: 'OTP verification required' });
    }
}
