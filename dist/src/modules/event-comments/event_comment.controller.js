import * as Repo from './event_comment.repo';
import { WSGateway } from '../../ws/gateway';
export const EventCommentController = {
    create: async (req, res) => {
        const { event_id, text } = req.body || {};
        const avitag = req.user?.avitag ?? null;
        if (!event_id || !text)
            return res.status(400).json({ success: false, message: 'event_id and text are required' });
        const created = await Repo.create({ event_id, avitag, text });
        try {
            WSGateway.broadcast('event_comment:created', { event_id, comment: created });
        }
        catch { }
        return res.status(201).json({ success: true, data: created });
    },
    get: async (req, res) => {
        const c = await Repo.get(req.params.comment_id);
        if (!c)
            return res.status(404).json({ success: false, message: 'Comment not found' });
        return res.json({ success: true, data: c });
    },
    listByEvent: async (req, res) => {
        const event_id = req.params.event_id;
        const limit = Number(req.query.limit ?? 20);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const data = await Repo.listByEvent(event_id, limit, cursor);
        return res.json({ success: true, data });
    },
    update: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { text } = req.body || {};
        const updated = await Repo.update(req.params.comment_id, req.user.avitag, text);
        if (!updated)
            return res.status(404).json({ success: false, message: 'Comment not found or forbidden' });
        try {
            WSGateway.broadcast('event_comment:updated', { event_id: updated.event_id, comment: updated });
        }
        catch { }
        return res.json({ success: true, data: updated });
    },
    remove: async (req, res) => {
        const role = req.user?.role;
        if (role === 'IDIOT') {
            const ok = await Repo.removeAsAdmin(req.params.comment_id);
            if (!ok)
                return res.status(404).json({ success: false, message: 'Comment not found' });
            try {
                WSGateway.broadcast('event_comment:deleted', { comment_id: req.params.comment_id });
            }
            catch { }
            return res.json({ success: true, message: 'Deleted' });
        }
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const ok = await Repo.remove(req.params.comment_id, req.user.avitag);
        if (!ok)
            return res.status(404).json({ success: false, message: 'Comment not found or forbidden' });
        try {
            WSGateway.broadcast('event_comment:deleted', { comment_id: req.params.comment_id });
        }
        catch { }
        return res.json({ success: true, message: 'Deleted' });
    },
};
