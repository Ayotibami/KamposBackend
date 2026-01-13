"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const cloudinary_1 = require("../../services/media/cloudinary");
const db_1 = require("../../config/db");
const router = (0, express_1.Router)();
// Utility to detect which table holds the avitag
async function detectTable(avitag) {
    const checks = [
        { sql: 'SELECT 1 FROM student_profiles WHERE avitag = $1', t: 'student_profiles' },
        { sql: 'SELECT 1 FROM kreator_profiles WHERE avitag = $1', t: 'kreator_profiles' },
        { sql: 'SELECT 1 FROM kompany_profiles WHERE avitag = $1', t: 'kompany_profiles' },
        { sql: 'SELECT 1 FROM school_profiles WHERE avitag = $1', t: 'school_profiles' },
    ];
    for (const c of checks) {
        const { rowCount } = await db_1.pool.query(c.sql, [avitag]);
        if ((rowCount || 0) > 0)
            return c.t;
    }
    return null;
}
// POST /api/v1/profiles/upload-picture  (form-data: avitag, image)
router.post('/upload-picture', auth_1.isAuth, async (req, res) => {
    const { avitag } = req.body || {};
    if (!avitag)
        return res.status(400).json({ success: false, message: 'avitag is required' });
    const table = await detectTable(avitag);
    if (!table)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    // Verify ownership
    const { rowCount } = await db_1.pool.query(`SELECT 1 FROM ${table} WHERE avitag = $1 AND account_id = $2`, [avitag, req.user.account_id]);
    if ((rowCount || 0) === 0 && req.user?.profileType !== 'IDIOT') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!req.files || !('image' in req.files)) {
        return res.status(400).json({ success: false, message: 'image file is required' });
    }
    const fileAny = req.files.image;
    const file = Array.isArray(fileAny) ? fileAny[0] : fileAny;
    const buffer = file?.data;
    if (!buffer)
        return res.status(400).json({ success: false, message: 'Invalid image' });
    try {
        const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/profiles/${avitag}`);
        const url = uploaded.secure_url || uploaded.url;
        const column = table === 'kompany_profiles' ? 'image_url' : 'image_url';
        await db_1.pool.query(`UPDATE ${table} SET ${column} = $1, updated_at = NOW() WHERE avitag = $2`, [url, avitag]);
        return res.json({ success: true, url });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e?.message || 'Upload failed' });
    }
});
exports.default = router;
