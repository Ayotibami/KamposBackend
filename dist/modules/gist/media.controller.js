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
exports.GistMediaController = void 0;
const mediaRepo = __importStar(require("./media.repo"));
const cloudinary_1 = require("../../services/media/cloudinary");
const gateway_1 = require("../../ws/gateway");
exports.GistMediaController = {
    upload: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const gist_id = req.params.gist_id;
        // Accept single file field 'file'
        const filesAny = req.files;
        const f = filesAny?.file ? (Array.isArray(filesAny.file) ? filesAny.file[0] : filesAny.file) : null;
        const buffer = f?.data ?? null;
        if (!buffer)
            return res.status(400).json({ success: false, message: 'file required' });
        // Validate size/type: allow image/* up to 10MB, video/* up to 100MB
        const mimetype = f.mimetype || '';
        const size = typeof f.size === 'number' ? f.size : buffer.length;
        const isImage = mimetype.startsWith('image/');
        const isVideo = mimetype.startsWith('video/');
        if (!isImage && !isVideo) {
            return res.status(415).json({ success: false, message: 'Unsupported media type. Allowed: image/*, video/*' });
        }
        if (isImage && size > 10 * 1024 * 1024) {
            return res.status(413).json({ success: false, message: 'Image too large (max 10MB)' });
        }
        if (isVideo && size > 100 * 1024 * 1024) {
            return res.status(413).json({ success: false, message: 'Video too large (max 100MB)' });
        }
        const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/gists/${gist_id}`);
        const media_type = (uploaded.resource_type === 'video' ? 'VIDEO' : 'IMAGE');
        const media_url = uploaded.secure_url || uploaded.url;
        const thumbnail_url = uploaded?.thumbnail_url || uploaded?.eager?.[0]?.secure_url || null;
        const public_id = uploaded?.public_id || null;
        const saved = await mediaRepo.addMedia({ gist_id, media_type, media_url, thumbnail_url, public_id });
        try {
            gateway_1.WSGateway.broadcast('gist_media:created', { gist_id, media: saved });
        }
        catch { }
        return res.status(201).json({ success: true, data: saved });
    },
    list: async (req, res) => {
        const gist_id = req.params.gist_id;
        const media = await mediaRepo.listByGist(gist_id);
        return res.json({ success: true, data: media });
    },
    update: async (req, res) => {
        const media_id = req.params.media_id;
        const updated = await mediaRepo.updateMedia(media_id, req.body || {});
        if (!updated)
            return res.status(404).json({ success: false, message: 'Not found' });
        try {
            gateway_1.WSGateway.broadcast('gist_media:updated', { gist_id: updated.gist_id, media: updated });
        }
        catch { }
        return res.json({ success: true, data: updated });
    },
    remove: async (req, res) => {
        const media_id = req.params.media_id;
        const existing = await mediaRepo.get(media_id);
        if (!existing)
            return res.status(404).json({ success: false, message: 'Not found' });
        if (existing.public_id) {
            try {
                await (0, cloudinary_1.deleteByPublicId)(existing.public_id);
            }
            catch { /* ignore delete errors */ }
        }
        const ok = await mediaRepo.remove(media_id);
        if (!ok)
            return res.status(404).json({ success: false, message: 'Not found' });
        try {
            gateway_1.WSGateway.broadcast('gist_media:deleted', { gist_id: existing.gist_id, media_id });
        }
        catch { }
        return res.json({ success: true, message: 'Deleted' });
    },
    reorder: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const gist_id = req.params.gist_id;
        const { media_ids } = req.body || {};
        if (!Array.isArray(media_ids) || media_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'media_ids array required' });
        }
        const updated = await mediaRepo.reorderMedia(gist_id, media_ids);
        try {
            gateway_1.WSGateway.broadcast('gist_media:reordered', { gist_id, media_ids });
        }
        catch { }
        return res.json({ success: true, data: updated });
    },
};
