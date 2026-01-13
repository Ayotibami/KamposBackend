"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthController = void 0;
const oauth_service_1 = require("./oauth.service");
exports.OAuthController = {
    google: async (req, res) => {
        const { id_token, refresh_token, refresh_expires_at } = req.body || {};
        try {
            const { account, token } = await oauth_service_1.OAuthService.googleLogin({ id_token, refresh_token, refresh_expires_at });
            return res.status(201).json({ success: true, data: { account, token } });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Google login failed' });
        }
    },
    facebook: async (req, res) => {
        const { access_token, refresh_token, refresh_expires_at } = req.body || {};
        try {
            const { account, token } = await oauth_service_1.OAuthService.facebookLogin({ access_token, refresh_token, refresh_expires_at });
            return res.status(201).json({ success: true, data: { account, token } });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Facebook login failed' });
        }
    },
    apple: async (req, res) => {
        const { identity_token, refresh_token, refresh_expires_at } = req.body || {};
        try {
            const { account, token } = await oauth_service_1.OAuthService.appleLogin({ identity_token, refresh_token, refresh_expires_at });
            return res.status(201).json({ success: true, data: { account, token } });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Apple login failed' });
        }
    },
};
