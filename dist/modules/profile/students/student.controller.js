"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.verify = exports.update = exports.list = exports.get = exports.create = void 0;
const repo = __importStar(require("./repo"));
const cloudinary_1 = require("../../../services/media/cloudinary");
const env_1 = require("../../../config/env");
const profile_1 = require("../../../services/email/profile");
const create = async (req, res) => {
    if (!req.user?.account_id)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { avitag, first_name, last_name, display_name, campus_tag, major_tag, level, bio, hobbies, degree, image_url, } = req.body || {};
    if (!avitag || !first_name || !last_name) {
        return res.status(400).json({ success: false, message: 'avitag, first_name, last_name are required' });
    }
    let finalImageUrl = null;
    // Prefer file upload if present
    const filesAny = req.files;
    if (filesAny && filesAny.image) {
        const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
        const buffer = file?.data;
        if (buffer) {
            const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/profiles/${avitag}`);
            finalImageUrl = uploaded.secure_url || uploaded.url || null;
        }
    }
    if (!finalImageUrl && image_url)
        finalImageUrl = image_url;
    if (!finalImageUrl && env_1.env.DEFAULT_PROFILE_PIC_URL)
        finalImageUrl = env_1.env.DEFAULT_PROFILE_PIC_URL;
    try {
        // Normalize hobbies: accept array, JSON string, or comma-separated string
        let hobbiesArr = null;
        if (Array.isArray(hobbies)) {
            hobbiesArr = hobbies;
        }
        else if (typeof hobbies === 'string') {
            const text = hobbies.trim();
            if (text.startsWith('[')) {
                try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed))
                        hobbiesArr = parsed;
                }
                catch { }
            }
            if (!hobbiesArr) {
                hobbiesArr = text.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        const created = await repo.create({
            avitag,
            account_id: req.user.account_id,
            first_name,
            last_name,
            display_name: display_name ?? null,
            campus_tag: campus_tag ?? null,
            major_tag: major_tag ?? null,
            level: level ?? null,
            bio: bio ?? null,
            hobbies: hobbiesArr ?? null,
            degree: degree ?? null,
            image_url: finalImageUrl ?? null,
        });
        // Fire-and-forget welcome email
        void (0, profile_1.sendWelcomeEmail)(req.user.account_id, { profile_type: 'STUDENT', first_name, display_name });
        return res.status(201).json({ success: true, data: created });
    }
    catch (err) {
        if (err?.code === '23503') {
            return res.status(400).json({ success: false, message: 'Invalid campus_tag or major_tag reference' });
        }
        return res.status(400).json({ success: false, message: err?.message || 'Unable to create student profile' });
    }
};
exports.create = create;
const get = async (req, res) => {
    const avitag = req.params.avitag;
    const profile = await repo.findByAvitag(avitag);
    if (!profile || profile.profile_status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    return res.json({ success: true, data: profile });
};
exports.get = get;
const list = async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await repo.listActive(limit, offset);
    return res.json({ success: true, data });
};
exports.list = list;
const update = async (req, res) => {
    if (!req.user?.account_id)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    const avitag = req.params.avitag;
    // Only owner or IDIOT can update
    const existing = await repo.findByAvitag(avitag);
    if (!existing)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    if (existing.account_id !== req.user.account_id && req.user.role !== 'IDIOT') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const updates = { ...req.body };
    // Normalize hobbies on update similarly
    if (updates.hobbies !== undefined) {
        if (Array.isArray(updates.hobbies)) {
            // ok
        }
        else if (typeof updates.hobbies === 'string') {
            const text = updates.hobbies.trim();
            let arr = null;
            if (text.startsWith('[')) {
                try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed))
                        arr = parsed;
                }
                catch { }
            }
            if (!arr)
                arr = text.split(',').map((s) => s.trim()).filter(Boolean);
            updates.hobbies = arr;
        }
    }
    // If a new image file is supplied, upload it and set image_url
    const filesAny = req.files;
    if (filesAny && filesAny.image) {
        const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
        const buffer = file?.data;
        if (buffer) {
            const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/profiles/${avitag}`);
            updates.image_url = uploaded.secure_url || uploaded.url || null;
        }
    }
    const updated = await repo.update(avitag, existing.account_id, updates);
    if (!updated)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, data: updated });
};
exports.update = update;
const verify = async (req, res) => {
    const avitag = req.params.avitag;
    const ok = await repo.setVerified(avitag, true);
    if (!ok)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, message: 'Verified' });
};
exports.verify = verify;
const remove = async (req, res) => {
    const avitag = req.params.avitag;
    const ok = await repo.remove(avitag);
    if (!ok)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, message: 'Deleted' });
};
exports.remove = remove;
