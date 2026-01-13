"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuth = isAuth;
exports.fakeAuth = fakeAuth;
const jwt_1 = require("../config/jwt");
const token_service_1 = require("../modules/auth/token.service");
async function isAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const token = auth.slice('Bearer '.length);
        const payload = (0, jwt_1.verifyToken)(token);
        // Check revocation list
        const revoked = await (0, token_service_1.isRevoked)(payload.jti);
        if (revoked) {
            return res.status(401).json({ success: false, message: 'Token revoked' });
        }
        // King bypass: always pass
        if (payload.who === 'king') {
            req.user = { ...payload, who: 'king', avitag: 'king', profileType: 'king' };
            return next();
        }
        req.user = payload;
        return next();
    }
    catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}
async function fakeAuth(req, _res, next) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
        // no token, proceed as anonymous
        return next();
    }
    try {
        const token = auth.slice('Bearer '.length);
        const payload = (0, jwt_1.verifyToken)(token);
        const revoked = await (0, token_service_1.isRevoked)(payload.jti);
        if (!revoked) {
            req.user = payload;
        }
    }
    catch (_e) {
        // ignore invalid token
    }
    return next();
}
