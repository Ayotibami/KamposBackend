import type { Request, Response } from 'express';
import * as repo from './notification.repo';

export const NotificationController = {
  list: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const data = await repo.listForUser(req.user.avitag, limit, cursor);
    return res.json({ success: true, data });
  },

  unreadCount: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const count = await repo.unreadCount(req.user.avitag);
    return res.json({ success: true, data: { count } });
  },

  markRead: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const ok = await repo.markRead(req.params.notification_id, req.user.avitag);
    if (!ok) return res.status(404).json({ success: false, message: 'Notification not found' });
    return res.json({ success: true });
  },

  markAllRead: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await repo.markAllRead(req.user.avitag);
    return res.json({ success: true });
  },

  getPreferences: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const muted_categories = await repo.getPreferences(req.user.avitag);
    return res.json({ success: true, data: { muted_categories } });
  },

  setPreferences: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { muted_categories } = req.body || {};
    const VALID = ['COMMENT', 'REPOST', 'HOT_EXPIRING', 'DIGEST', 'INACTIVITY_NUDGE', 'ACTIVATION_NUDGE'];
    if (!Array.isArray(muted_categories) || muted_categories.some((c) => !VALID.includes(c))) {
      return res.status(400).json({ success: false, message: `muted_categories must be an array of: ${VALID.join(', ')}` });
    }
    await repo.setMutedCategories(req.user.avitag, muted_categories);
    return res.json({ success: true });
  },
};
