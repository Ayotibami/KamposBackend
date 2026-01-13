"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = void 0;
const notFound = (req, res) => {
    return res.status(404).json({ success: false, message: 'Not Found' });
};
exports.notFound = notFound;
const errorHandler = (err, _req, res, _next) => {
    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    return res.status(status).json({ success: false, message });
};
exports.errorHandler = errorHandler;
