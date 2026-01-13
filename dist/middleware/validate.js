"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const validateBody = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    }
    catch (err) {
        const issues = err?.issues || [];
        return res.status(400).json({ success: false, message: 'Validation error', errors: issues });
    }
};
exports.validateBody = validateBody;
