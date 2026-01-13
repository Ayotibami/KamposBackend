"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appleOAuthSchema = exports.facebookOAuthSchema = exports.googleOAuthSchema = void 0;
const zod_1 = require("zod");
exports.googleOAuthSchema = zod_1.z.object({
    id_token: zod_1.z.string().min(10),
    refresh_token: zod_1.z.string().optional().nullable(),
    refresh_expires_at: zod_1.z.union([zod_1.z.coerce.date(), zod_1.z.string()]).optional().nullable(),
});
exports.facebookOAuthSchema = zod_1.z.object({
    access_token: zod_1.z.string().min(10),
    refresh_token: zod_1.z.string().optional().nullable(),
    refresh_expires_at: zod_1.z.union([zod_1.z.coerce.date(), zod_1.z.string()]).optional().nullable(),
});
exports.appleOAuthSchema = zod_1.z.object({
    identity_token: zod_1.z.string().min(10),
    refresh_token: zod_1.z.string().optional().nullable(),
    refresh_expires_at: zod_1.z.union([zod_1.z.coerce.date(), zod_1.z.string()]).optional().nullable(),
});
