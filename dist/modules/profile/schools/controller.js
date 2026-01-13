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
    const { avitag, display_name, description, campus_tag, website, image_url } = req.body || {};
    if (!avitag || !display_name) {
        return res.status(400).json({ success: false, message: 'avitag and display_name are required' });
    }
    let finalUrl = image_url ?? null;
    const filesAny = req.files;
    if (filesAny && filesAny.image) {
        const f = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
        const buffer = f?.data;
        if (buffer) {
            const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/profiles/${avitag}`);
            finalUrl = uploaded.secure_url || uploaded.url || null;
        }
    }
    if (!finalUrl && env_1.env.DEFAULT_PROFILE_PIC_URL)
        finalUrl = env_1.env.DEFAULT_PROFILE_PIC_URL;
    const created = await repo.create({
        avitag,
        account_id: req.user.account_id,
        display_name,
        description: description ?? null,
        campus_tag: campus_tag ?? null,
        image_url: finalUrl ?? null,
        website: website ?? null,
    });
    void (0, profile_1.sendWelcomeEmail)(req.user.account_id, { profile_type: 'SCHOOL', display_name });
    return res.status(201).json({ success: true, data: created });
};
exports.create = create;
const get = async (req, res) => {
    const p = await repo.findByAvitag(req.params.avitag);
    if (!p || !p.is_verified || p.profile_status !== 'ACTIVE')
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, data: p });
};
exports.get = get;
const list = async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await repo.listVerifiedActive(limit, offset);
    return res.json({ success: true, data });
};
exports.list = list;
const update = async (req, res) => {
    if (!req.user?.account_id)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    const existing = await repo.findByAvitag(req.params.avitag);
    if (!existing)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    if (existing.account_id !== req.user.account_id && req.user.profileType !== 'IDIOT') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const updates = { ...req.body };
    const filesAny = req.files;
    if (filesAny && filesAny.image) {
        const f = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
        const buffer = f?.data;
        if (buffer) {
            const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/profiles/${existing.avitag}`);
            updates.image_url = uploaded.secure_url || uploaded.url || null;
        }
    }
    const updated = await repo.update(existing.avitag, existing.account_id, updates);
    if (!updated)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, data: updated });
};
exports.update = update;
const verify = async (req, res) => {
    const ok = await repo.setVerified(req.params.avitag, true);
    if (!ok)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, message: 'Verified' });
};
exports.verify = verify;
const remove = async (req, res) => {
    const ok = await repo.remove(req.params.avitag);
    if (!ok)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, message: 'Deleted' });
};
exports.remove = remove;
