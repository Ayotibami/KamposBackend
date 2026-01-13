import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from './env';
export function signToken(payload) {
    const jti = randomUUID();
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES, jwtid: jti });
}
export function verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}
