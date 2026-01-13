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
exports.OTPController = void 0;
const otp_service_1 = require("./otp.service");
const otp_1 = require("../../utils/otp");
const accountRepo = __importStar(require("../account/account.repo"));
exports.OTPController = {
    send: async (req, res) => {
        const { email } = req.body || {};
        if (!email)
            return res.status(400).json({ success: false, message: 'email is required' });
        // Do not send OTP if already verified (to save costs)
        const acc = await accountRepo.findAccountByEmail(email);
        if (acc?.is_otp_verified) {
            return res.json({ success: true, message: 'Email already verified' });
        }
        const code = (0, otp_1.generateOTP)();
        await otp_service_1.OTPService.send(email, code);
        return res.json({ success: true, message: 'OTP sent' });
    },
    verify: async (req, res) => {
        const { email, code } = req.body || {};
        if (!email || !code)
            return res.status(400).json({ success: false, message: 'email and code are required' });
        try {
            const result = await otp_service_1.OTPService.verify(email, code);
            return res.json({ success: true, data: result });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Invalid code' });
        }
    },
};
