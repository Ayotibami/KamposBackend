import type { Request, Response } from 'express';
import * as repo from './comment.repo';
import { WSGateway } from '../../ws/gateway';

export const CommentController = {
  create: async (req: Request, res: Response) => {
    const { gist_id, text } = req.body || {};
    const avitag = req.user?.avitag ?? null;
    if (!avitag)
      return res.status(400).json({
        success: false,
        message: 'Active profile (avitag) is required. Switch profile and retry.',
      });
    if (!gist_id || !text) return res.status(400).json({ success: false, message: 'gist_id and text are required' });
    const created = await repo.create({ gist_id, avitag, text });
    // The WS `comments:create` message path already broadcasts this — the
    // REST path (what every current client actually uses) didn't, so
    // nobody else viewing the same gist ever learned about a new comment
    // in realtime unless they'd created it themselves over a raw WS message.
    WSGateway.broadcast('comment:created', { comment: created });
    return res.status(201).json({ success: true, data: created });
  },

  get: async (req: Request, res: Response) => {
    const c = await repo.get(req.params.comment_id);
    if (!c) return res.status(404).json({ success: false, message: 'Comment not found' });
    return res.json({ success: true, data: c });
  },

  listByGist: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    const limit = Number(req.query.limit ?? 20);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const data = await repo.listByGist(gist_id, limit, cursor, req.user?.avitag);
    return res.json({ success: true, data });
  },

  listBatch: async (req: Request, res: Response) => {
    const raw = typeof req.query.gist_ids === 'string' ? req.query.gist_ids : '';
    const gist_ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const limit = Number(req.query.limit ?? 20);
    if (gist_ids.length === 0) return res.json({ success: true, data: {} });
    const data = await repo.listBatchByGistIds(gist_ids, limit, req.user?.avitag);
    return res.json({ success: true, data });
  },

  listByUser: async (req: Request, res: Response) => {
    const avitag = req.params.avitag;
    const limit = Number(req.query.limit ?? 20);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const data = await repo.listByUser(avitag, limit, cursor);
    return res.json({ success: true, data });
  },

  update: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { text } = req.body || {};
    const updated = await repo.update(req.params.comment_id, req.user.avitag, text);
    if (!updated) return res.status(404).json({ success: false, message: 'Comment not found or forbidden' });
    return res.json({ success: true, data: updated });
  },

  remove: async (req: Request, res: Response) => {
    const role = req.user?.role;
    if (role === 'IDIOT') {
      const ok = await repo.removeAsAdmin(req.params.comment_id);
      if (!ok) return res.status(404).json({ success: false, message: 'Comment not found' });
      return res.json({ success: true, message: 'Deleted' });
    }
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const ok = await repo.remove(req.params.comment_id, req.user.avitag);
    if (!ok) return res.status(404).json({ success: false, message: 'Comment not found or forbidden' });
    return res.json({ success: true, message: 'Deleted' });
  },
};
