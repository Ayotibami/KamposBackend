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
exports.EventController = void 0;
const EventRepo = __importStar(require("./event.repo"));
const cloudinary_1 = require("../../services/media/cloudinary");
const gateway_1 = require("../../ws/gateway");
const utils_1 = require("../profile/utils");
exports.EventController = {
    create: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        // Parse body fields (works for JSON or multipart/form-data)
        const { title, location, description, event_date } = req.body || {};
        let host_avi_tags = [];
        try {
            const raw = req.body?.host_avi_tags;
            if (Array.isArray(raw))
                host_avi_tags = raw;
            else if (typeof raw === 'string') {
                try {
                    host_avi_tags = JSON.parse(raw);
                }
                catch {
                    host_avi_tags = raw.split(',').map((s) => s.trim()).filter(Boolean);
                }
            }
            if (!host_avi_tags.length)
                host_avi_tags = [req.user.avitag];
            if (host_avi_tags.length > 3)
                return res.status(400).json({ success: false, message: 'host_avi_tags max 3' });
        }
        catch {
            return res.status(400).json({ success: false, message: 'Invalid host_avi_tags' });
        }
        // Optional thumbnail from form-data field 'thumbnail'
        let thumbnail_url = null;
        const filesAny = req.files;
        const thumb = filesAny?.thumbnail ? (Array.isArray(filesAny.thumbnail) ? filesAny.thumbnail[0] : filesAny.thumbnail) : null;
        if (thumb && thumb.data) {
            const buffer = thumb.data;
            const mimetype = thumb.mimetype || '';
            const size = typeof thumb.size === 'number' ? thumb.size : buffer.length;
            const isImage = mimetype.startsWith('image/');
            if (!isImage)
                return res.status(415).json({ success: false, message: 'Thumbnail must be an image' });
            if (size > 10 * 1024 * 1024)
                return res.status(413).json({ success: false, message: 'Thumbnail too large (max 10MB)' });
            const uploaded = await (0, cloudinary_1.uploadBuffer)(buffer, `kampos/events`);
            thumbnail_url = uploaded?.secure_url || uploaded?.url || null;
        }
        const { campus_tag, major_tag } = await (0, utils_1.getCampusMajor)(req.user.avitag);
        const ev = await EventRepo.create({
            title,
            host_avi_tags,
            location,
            description,
            event_date: new Date(event_date),
            thumbnail_url,
            campus_tag,
            major_tag,
        });
        try {
            gateway_1.WSGateway.broadcast('event.created', { event: ev });
        }
        catch { }
        return res.status(201).json({ success: true, data: ev });
    },
    list: async (req, res) => {
        const limit = Number(req.query.limit ?? 20);
        const before = typeof req.query.before === 'string' ? req.query.before : undefined;
        const data = await EventRepo.list(limit, before);
        return res.json({ success: true, data });
    },
    get: async (req, res) => {
        const { event_id } = req.params;
        const row = await EventRepo.findById(event_id);
        if (!row)
            return res.status(404).json({ success: false, message: 'Event not found' });
        return res.json({ success: true, data: row });
    },
    update: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { event_id } = req.params;
        const patch = {};
        for (const k of ['title', 'host_avi_tags', 'location', 'description', 'event_date', 'thumbnail_url']) {
            if (req.body[k] !== undefined)
                patch[k] = req.body[k];
        }
        if (patch.event_date)
            patch.event_date = new Date(patch.event_date);
        const updated = await EventRepo.update(event_id, patch);
        if (!updated)
            return res.status(404).json({ success: false, message: 'Event not found' });
        try {
            gateway_1.WSGateway.broadcast('event.updated', { event: updated });
        }
        catch { }
        return res.json({ success: true, data: updated });
    },
    remove: async (req, res) => {
        const { event_id } = req.params;
        const ok = await EventRepo.remove(event_id);
        if (!ok)
            return res.status(404).json({ success: false, message: 'Event not found' });
        try {
            gateway_1.WSGateway.broadcast('event.deleted', { event_id });
        }
        catch { }
        return res.json({ success: true, message: 'Deleted' });
    },
    view: async (req, res) => {
        const { event_id } = req.params;
        await EventRepo.incrementView(event_id, req.user?.avitag ?? null);
        try {
            gateway_1.WSGateway.broadcast('event.viewed', { event_id, by: req.user?.avitag ?? null });
        }
        catch { }
        return res.json({ success: true });
    },
};
