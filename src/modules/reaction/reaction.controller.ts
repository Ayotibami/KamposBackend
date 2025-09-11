import type { Request, Response } from 'express';
import * as repo from './reaction.repo';

export const ReactionController = {
  upsert: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { entity_type, entity_id, type } = req.body || {};
    const r = await repo.upsert({ avitag: req.user.avitag, entity_type, entity_id, type });
    return res.status(201).json({ success: true, data: r });
  },

  listByEntity: async (req: Request, res: Response) => {
    const { entity_type, entity_id } = req.params as any;
    const data = await repo.listByEntity(entity_type, entity_id);
    return res.json({ success: true, data });
  },

  listByUser: async (req: Request, res: Response) => {
    const { avitag } = req.params as any;
    const data = await repo.listByUser(avitag);
    return res.json({ success: true, data });
  },

  remove: async (req: Request, res: Response) => {
    const role = req.user?.role;
    const reaction_id = req.params.reaction_id;
    if (role === 'IDIOT') {
      const ok = await repo.removeById(reaction_id);
      if (!ok) return res.status(404).json({ success: false, message: 'Reaction not found' });
      return res.json({ success: true, message: 'Deleted' });
    }
    return res.status(403).json({ success: false, message: 'Forbidden' });
  },

  removeByEntity: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { entity_type, entity_id } = req.params as any;
    const ok = await repo.removeByComposite(entity_type as any, entity_id, req.user.avitag);
    if (!ok) return res.status(404).json({ success: false, message: 'Reaction not found' });
    return res.json({ success: true, message: 'Deleted' });
  },
};
