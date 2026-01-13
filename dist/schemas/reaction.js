"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeByEntitySchema = exports.upsertReactionSchema = void 0;
const zod_1 = require("zod");
exports.upsertReactionSchema = zod_1.z.object({
    entity_type: zod_1.z.enum(['GIST', 'COMMENT']),
    entity_id: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['LIKE', 'LOVE', 'FIRE', 'SAD', 'WOW']),
});
exports.removeByEntitySchema = zod_1.z.object({
    entity_type: zod_1.z.enum(['GIST', 'COMMENT']),
    entity_id: zod_1.z.string().uuid(),
});
