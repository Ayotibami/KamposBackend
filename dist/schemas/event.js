"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEventSchema = exports.createEventSchema = void 0;
const zod_1 = require("zod");
exports.createEventSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    host_avi_tags: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(3),
    location: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    event_date: zod_1.z.coerce.date(),
});
exports.updateEventSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255).optional(),
    host_avi_tags: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(3).optional(),
    location: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).optional(),
    event_date: zod_1.z.coerce.date().optional(),
});
