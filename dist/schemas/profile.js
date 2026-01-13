"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolCreateSchema = exports.kompanyCreateSchema = exports.kreatorCreateSchema = exports.studentCreateSchema = void 0;
const zod_1 = require("zod");
exports.studentCreateSchema = zod_1.z.object({
    avitag: zod_1.z.string().min(2),
    first_name: zod_1.z.string().min(1),
    last_name: zod_1.z.string().min(1),
    display_name: zod_1.z.string().optional().nullable(),
    campus_tag: zod_1.z.string().optional().nullable(),
    major_tag: zod_1.z.string().optional().nullable(),
    level: zod_1.z.union([zod_1.z.coerce.number().int(), zod_1.z.string()]).optional().nullable(),
    bio: zod_1.z.string().optional().nullable(),
    hobbies: zod_1.z.union([zod_1.z.array(zod_1.z.string()), zod_1.z.string()]).optional().nullable(),
    degree: zod_1.z.enum(['BACHELORS', 'MASTERS', 'PHD']).optional().nullable(),
    image_url: zod_1.z.string().url().optional().nullable(),
});
exports.kreatorCreateSchema = zod_1.z.object({
    avitag: zod_1.z.string().min(2),
    display_name: zod_1.z.string().min(1),
    campustag: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    image_url: zod_1.z.string().url().optional().nullable(),
});
exports.kompanyCreateSchema = zod_1.z.object({
    avitag: zod_1.z.string().min(2),
    display_name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    phone_number: zod_1.z.string().min(3),
    website: zod_1.z.string().url(),
    social_links: zod_1.z.any().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    image_url: zod_1.z.string().url().optional().nullable(),
});
exports.schoolCreateSchema = zod_1.z.object({
    avitag: zod_1.z.string().min(2),
    display_name: zod_1.z.string().min(1),
    campus_tag: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    website: zod_1.z.string().url().optional().nullable(),
    image_url: zod_1.z.string().url().optional().nullable(),
});
