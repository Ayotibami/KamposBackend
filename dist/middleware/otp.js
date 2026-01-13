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
exports.requireOtpVerified = requireOtpVerified;
const accountRepo = __importStar(require("../modules/account/account.repo"));
const otp_service_1 = require("../modules/auth/otp.service");
const otp_1 = require("../utils/otp");
// Require that the authenticated account has verified OTP
// If not verified, send a fresh OTP and block the request with 403
async function requireOtpVerified(req, res, next) {
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
            const code = (0, otp_1.generateOTP)();
            await otp_service_1.OTPService.send(account.email, code);
        }
        return res.status(403).json({ success: false, message: 'OTP verification required. A new code has been sent to your email.' });
    }
    catch (err) {
        return res.status(403).json({ success: false, message: 'OTP verification required' });
    }
}
