"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetController = void 0;
const password_reset_service_1 = require("./password-reset.service");
exports.PasswordResetController = {
    request: async (req, res) => {
        const { email } = req.body || {};
        if (!email)
            return res.status(400).json({ success: false, message: 'email is required' });
        await password_reset_service_1.PasswordResetService.request(email);
        return res.json({ success: true, message: 'Password reset token has been sent to your email' });
    },
    reset: async (req, res) => {
        const { email, code, newPassword } = req.body || {};
        if (!email || !code || !newPassword) {
            return res.status(400).json({ success: false, message: 'email, code and newPassword are required' });
        }
        try {
            await password_reset_service_1.PasswordResetService.reset(email, code, newPassword);
            return res.json({ success: true, message: 'Password reset successful' });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Reset failed' });
        }
    },
};
