import type { Request, Response } from 'express';
import * as repo from './reaction.repo';
import { WSGateway } from '../../ws/gateway';
import { GistService } from '../gist/gist.service';

// The WS `reactions:upsert`/`reactions:remove_by_entity` message path
// already broadcasts counts:updated — the REST path (what every current
// client actually uses, see gistStore.ts/commentStore.ts) didn't, so nobody
// else viewing the same gist ever learned about a reaction changing in
// realtime unless they'd reacted themselves over a raw WS message.
async function broadcastGistCounts(gist_id: string) {
  try {
    const countsFull = await GistService.getCountsFull(gist_id);
    WSGateway.broadcast('counts:updated', { gist_id, ...countsFull });
  } catch {}
}

export const ReactionController = {
  upsert: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { entity_type, entity_id, type } = req.body || {};
    const r = await repo.upsert({ avitag: req.user.avitag, entity_type, entity_id, type });
    if (entity_type === 'GIST') void broadcastGistCounts(entity_id);
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
      // Need the entity this reaction was on before it's gone, same reason
      // comment.controller.ts's remove() looks the row up first — the
      // counts broadcast below needs a gist_id, and removeById only ever
      // returns a boolean.
      const existing = await repo.getById(reaction_id);
      const ok = await repo.removeById(reaction_id);
      if (!ok) return res.status(404).json({ success: false, message: 'Reaction not found' });
      if (existing?.entity_type === 'GIST') void broadcastGistCounts(existing.entity_id);
      return res.json({ success: true, message: 'Deleted' });
    }
    return res.status(403).json({ success: false, message: 'Forbidden' });
  },

  removeByEntity: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { entity_type, entity_id } = req.params as any;
    const ok = await repo.removeByComposite(entity_type as any, entity_id, req.user.avitag);
    if (!ok) return res.status(404).json({ success: false, message: 'Reaction not found' });
    if (entity_type === 'GIST') void broadcastGistCounts(entity_id);
    return res.json({ success: true, message: 'Deleted' });
  },
};
