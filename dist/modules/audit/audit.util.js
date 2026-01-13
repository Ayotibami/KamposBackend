"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeAudit = safeAudit;
const audit_repo_1 = require("./audit.repo");
async function safeAudit(params) {
    try {
        await (0, audit_repo_1.logAudit)(params);
    }
    catch {
        // swallow audit errors to avoid breaking the moderation action
    }
}
