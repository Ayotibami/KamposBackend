"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIdiot = isIdiot;
function isIdiot(req, res, next) {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (user.role === 'king') {
        // king always passes
        return next();
    }
    if (user.profileType === 'IDIOT') {
        return next();
    }
    return res.status(403).json({ success: false, message: 'IDIOT role required' });
}
