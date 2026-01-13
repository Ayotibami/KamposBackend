"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const db_1 = require("../../config/db");
async function logAudit(params) {
    await db_1.pool.query(`INSERT INTO audit_logs (action, target_type, target_id, idiot_avitag, reason)
     VALUES ($1, $2, $3, $4, $5)`, [params.action, params.target_type, params.target_id, params.idiot_avitag, params.reason ?? null]);
}
