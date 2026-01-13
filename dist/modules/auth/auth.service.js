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
exports.AuthService = void 0;
const accountRepo = __importStar(require("../account/account.repo"));
const repo_1 = require("../profile/idiots/repo");
const argon2_1 = __importDefault(require("argon2"));
const jwt_1 = require("../../config/jwt");
const otp_service_1 = require("./otp.service");
const otp_1 = require("../../utils/otp");
exports.AuthService = {
    register: async (email, password) => {
        const existing = await accountRepo.findAccountByEmail(email);
        if (existing) {
            throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
        }
        const password_hash = await argon2_1.default.hash(password, { type: argon2_1.default.argon2id });
        const account = await accountRepo.createAccountEmail(email, password_hash);
        // Send OTP for verification
        const code = (0, otp_1.generateOTP)();
        await otp_service_1.OTPService.send(email, code);
        const token = (0, jwt_1.signToken)({ account_id: account.account_id, is_otp_verified: false, role: 'USER' });
        return { account, token };
    },
    login: async (email, password) => {
        const account = await accountRepo.findAccountByEmail(email);
        if (!account || !account.password_hash) {
            throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
        }
        const ok = await argon2_1.default.verify(account.password_hash, password);
        if (!ok) {
            throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
        }
        await accountRepo.updateLastLogin(account.account_id);
        // If not verified, send OTP automatically
        if (!account.is_otp_verified) {
            const code = (0, otp_1.generateOTP)();
            await otp_service_1.OTPService.send(email, code);
        }
        // Block login if this account has an unverified IDIOT profile
        if (await (0, repo_1.hasUnverifiedForAccount)(account.account_id)) {
            throw Object.assign(new Error('Your IDIOT profile requires superadmin approval before you can login'), { statusCode: 403 });
        }
        const role = account.who === 'king' ? 'king' : 'USER';
        const token = (0, jwt_1.signToken)({ account_id: account.account_id, is_otp_verified: account.is_otp_verified, role });
        return { account, token };
    },
    issueTokenForProfile: async (claims) => {
        let isVerified = false;
        if (claims.account_id) {
            const acc = await accountRepo.findAccountById(claims.account_id);
            isVerified = !!acc?.is_otp_verified;
        }
        return (0, jwt_1.signToken)({ ...claims, is_otp_verified: isVerified, role: claims.role ?? 'USER' });
    },
};
