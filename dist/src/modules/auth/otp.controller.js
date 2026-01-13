import { OTPService } from './otp.service';
import { generateOTP } from '../../utils/otp';
import * as accountRepo from '../account/account.repo';
export const OTPController = {
    send: async (req, res) => {
        const { email } = req.body || {};
        if (!email)
            return res.status(400).json({ success: false, message: 'email is required' });
        // Do not send OTP if already verified (to save costs)
        const acc = await accountRepo.findAccountByEmail(email);
        if (acc?.is_otp_verified) {
            return res.json({ success: true, message: 'Email already verified' });
        }
        const code = generateOTP();
        await OTPService.send(email, code);
        return res.json({ success: true, message: 'OTP sent' });
    },
    verify: async (req, res) => {
        const { email, code } = req.body || {};
        if (!email || !code)
            return res.status(400).json({ success: false, message: 'email and code are required' });
        try {
            const result = await OTPService.verify(email, code);
            return res.json({ success: true, data: result });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Invalid code' });
        }
    },
};
