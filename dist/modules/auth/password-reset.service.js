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
exports.PasswordResetService = void 0;
const accountRepo = __importStar(require("../account/account.repo"));
const otpRepo = __importStar(require("./otp.repo"));
const email_service_1 = require("../../services/email/email.service");
const otp_1 = require("../../utils/otp");
const argon2_1 = __importDefault(require("argon2"));
exports.PasswordResetService = {
    async request(email) {
        const account = await accountRepo.findAccountByEmail(email);
        if (!account) {
            throw Object.assign(new Error('Account with this email does not exist'), { statusCode: 404 });
        }
        const code = (0, otp_1.generateOTP)();
        await otpRepo.createOTP(email, code, 600);
        try {
            await (0, email_service_1.sendPasswordResetEmail)(email, code, 10);
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
        const hash = await argon2_1.default.hash(newPassword, { type: argon2_1.default.argon2id });
        await accountRepo.updatePasswordHash(account.account_id, hash);
        await otpRepo.deleteOTP(otp.id);
        return { reset: true };
    },
};
