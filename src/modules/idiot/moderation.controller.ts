import type { Request, Response } from 'express';
import { ModerationService } from './moderation.service';

export const ModerationController = {
  listPendingGists: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await ModerationService.listPendingGists(limit, offset);
    res.json({ success: true, data });
  },

  listPendingProfiles: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await ModerationService.listPendingProfiles(limit, offset);
    res.json({ success: true, data });
  },

  approveGist: async (req: Request, res: Response) => {
    if (!req.user?.avitag) {
      return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
    }
    const id = req.params.id;
    const updated = await ModerationService.approveGist(id, req.user.avitag);
    if (!updated) return res.status(404).json({ success: false, message: 'Gist not found' });
    res.json({ success: true, data: updated });
  },

  rejectGist: async (req: Request, res: Response) => {
    if (!req.user?.avitag) {
      return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
    }
    const id = req.params.id;
    const { reason } = req.body || {};
    const updated = await ModerationService.rejectGist(id, req.user.avitag, reason ?? null);
    if (!updated) return res.status(404).json({ success: false, message: 'Gist not found' });
    res.json({ success: true, data: updated });
  },

  verifyProfile: async (req: Request, res: Response) => {
    if (!req.user?.avitag) {
      return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
    }
    const avitag = req.params.avitag;
    const updated = await ModerationService.verifyProfile(avitag, req.user.avitag);
    if (!updated) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: updated });
  },

  rejectProfile: async (req: Request, res: Response) => {
    if (!req.user?.avitag) {
      return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
    }
    const avitag = req.params.avitag;
    const { reason } = req.body || {};
    const result = await ModerationService.rejectProfile(avitag, req.user.avitag, reason ?? null);
    res.json({ success: true, data: result });
  },
};
