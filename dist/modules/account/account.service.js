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
exports.AccountService = void 0;
const accountRepo = __importStar(require("./account.repo"));
const ProfileUtils = __importStar(require("../profile/utils"));
const argon2_1 = __importDefault(require("argon2"));
exports.AccountService = {
    me: async (account_id) => {
        const account = await accountRepo.findAccountById(account_id);
        if (!account)
            return null;
        const profiles = await ProfileUtils.listByAccount(account_id);
        return { account, profiles };
    },
    update: async (account_id, updates) => {
        if (updates.email) {
            await accountRepo.updateEmail(account_id, updates.email);
        }
        return accountRepo.findAccountById(account_id);
    },
    changePassword: async (account_id, currentPassword, newPassword) => {
        const account = await accountRepo.findAccountById(account_id);
        if (!account || !account.password_hash)
            throw Object.assign(new Error('Invalid account'), { statusCode: 400 });
        const ok = await argon2_1.default.verify(account.password_hash, currentPassword);
        if (!ok)
            throw Object.assign(new Error('Current password incorrect'), { statusCode: 401 });
        const hash = await argon2_1.default.hash(newPassword, { type: argon2_1.default.argon2id });
        await accountRepo.updatePasswordHash(account_id, hash);
        return { changed: true };
    },
    softDelete: async (account_id) => {
        await accountRepo.softDeleteAccount(account_id);
        return { deleted: true };
    },
};
