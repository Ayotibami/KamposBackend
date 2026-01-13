"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeToken = revokeToken;
exports.isRevoked = isRevoked;
const redis_1 = require("../../config/redis");
const key = (jti) => `jwt:blacklist:${jti}`;
async function revokeToken(jti, ttlSeconds) {
    // Store a marker for jti with expiration equal to remaining token lifetime
    await redis_1.redis.set(key(jti), 'revoked', { EX: Math.max(1, Math.floor(ttlSeconds)) });
}
async function isRevoked(jti) {
    if (!jti)
        return false; // If no jti, we cannot check blacklist (treat as not revoked)
    const val = await redis_1.redis.get(key(jti));
    return val === 'revoked';
}
