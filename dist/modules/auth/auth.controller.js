"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const ProfileUtils = __importStar(require("../profile/utils"));
const env_1 = require("../../config/env");
const token_service_1 = require("./token.service");
exports.AuthController = {
    register: async (req, res) => {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required' });
        }
        try {
            const { account, token } = await auth_service_1.AuthService.register(email, password);
            return res.status(201).json({ success: true, data: { account, token } });
        }
        catch (err) {
            const status = err.statusCode || 500;
            return res.status(status).json({ success: false, message: err.message || 'Registration failed' });
        }
    },
    login: async (req, res) => {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required' });
        }
        try {
            const { account, token } = await auth_service_1.AuthService.login(email, password);
            return res.json({ success: true, data: { account, token } });
        }
        catch (err) {
            const status = err.statusCode || 500;
            return res.status(status).json({ success: false, message: err.message || 'Login failed' });
        }
    },
    switchProfile: async (req, res) => {
        if (!req.user?.account_id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const { avitag } = req.body || {};
        if (!avitag) {
            return res.status(400).json({ success: false, message: 'avitag is required' });
        }
        const profile = await ProfileUtils.findByAvitag(avitag);
        if (!profile || profile.account_id !== req.user.account_id) {
            return res.status(404).json({ success: false, message: 'Profile not found for this account' });
        }
        // if (!profile.is_verified) {
        //   return res.status(403).json({ success: false, message: 'Profile not verified yet' });
        // }
        const adminIds = (env_1.env.ADMIN_ACCOUNT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        const role = adminIds.includes(req.user.account_id) ? 'IDIOT' : 'USER';
        const token = await auth_service_1.AuthService.issueTokenForProfile({
            account_id: req.user.account_id,
            avitag: profile.avitag,
            profileType: profile.profile_type,
            role,
        });
        return res.json({ success: true, data: { token, avitag: profile.avitag, profileType: profile.profile_type } });
    },
    logout: async (req, res) => {
        // Must be authenticated to logout
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const { jti, exp } = req.user;
        if (!jti || !exp) {
            // If missing identifiers, just respond ok without revocation
            return res.json({ success: true, message: 'Logged out' });
        }
        const now = Math.floor(Date.now() / 1000);
        const ttlSeconds = Math.max(1, exp - now);
        await (0, token_service_1.revokeToken)(jti, ttlSeconds);
        return res.json({ success: true, message: 'Logged out' });
    },
};
