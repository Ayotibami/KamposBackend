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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTPService = void 0;
const otpRepo = __importStar(require("./otp.repo"));
const accountRepo = __importStar(require("../account/account.repo"));
const email_service_1 = require("../../services/email/email.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const env_1 = require("../../config/env");
exports.OTPService = {
    async send(email, code) {
        const otp = await otpRepo.createOTP(email, code, 600);
        try {
            if (env_1.env.BREVO_PASSWORD) {
                await (0, email_service_1.sendOTPEmail)(email, code, 10);
            }
            else {
                // No email config: log OTP for dev convenience
                logger_1.default.warn({ email, code }, 'OTP (dev): Email config missing, logging code');
            }
        }
        catch (e) {
            // Email failures should not break the auth flow; also log OTP in dev
            logger_1.default.warn({ email, code, err: e }, 'OTP email failed; logging code for dev');
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
