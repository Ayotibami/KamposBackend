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
exports.CommentController = void 0;
const repo = __importStar(require("./comment.repo"));
exports.CommentController = {
    create: async (req, res) => {
        const { gist_id, text } = req.body || {};
        const avitag = req.user?.avitag ?? null;
        if (!gist_id || !text)
            return res.status(400).json({ success: false, message: 'gist_id and text are required' });
        const created = await repo.create({ gist_id, avitag, text });
        return res.status(201).json({ success: true, data: created });
    },
    get: async (req, res) => {
        const c = await repo.get(req.params.comment_id);
        if (!c)
            return res.status(404).json({ success: false, message: 'Comment not found' });
        return res.json({ success: true, data: c });
    },
    listByGist: async (req, res) => {
        const gist_id = req.params.gist_id;
        const limit = Number(req.query.limit ?? 20);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const data = await repo.listByGist(gist_id, limit, cursor);
        return res.json({ success: true, data });
    },
    listByUser: async (req, res) => {
        const avitag = req.params.avitag;
        const limit = Number(req.query.limit ?? 20);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const data = await repo.listByUser(avitag, limit, cursor);
        return res.json({ success: true, data });
    },
    update: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { text } = req.body || {};
        const updated = await repo.update(req.params.comment_id, req.user.avitag, text);
        if (!updated)
            return res.status(404).json({ success: false, message: 'Comment not found or forbidden' });
        return res.json({ success: true, data: updated });
    },
    remove: async (req, res) => {
        const role = req.user?.role;
        if (role === 'IDIOT') {
            const ok = await repo.removeAsAdmin(req.params.comment_id);
            if (!ok)
                return res.status(404).json({ success: false, message: 'Comment not found' });
            return res.json({ success: true, message: 'Deleted' });
        }
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const ok = await repo.remove(req.params.comment_id, req.user.avitag);
        if (!ok)
            return res.status(404).json({ success: false, message: 'Comment not found or forbidden' });
        return res.json({ success: true, message: 'Deleted' });
    },
};
