import type { Request, Response } from 'express';
import { ModerationService } from './moderation.service';
import { safeErrorMessage, safeErrorStatus } from '../../utils/errors';
import { signSocketTicket } from '../../config/jwt';

export const ModerationController = {
  /** Mints the short-lived ticket the admin panel's frontend exchanges for
   * a live Socket.IO connection (see ws/socketio.ts) — see signSocketTicket's
   * own doc comment for why this exists instead of just reusing the session
   * cookie directly. */
  socketTicket: async (req: Request, res: Response) => {
    const ticket = signSocketTicket({
      account_id: req.user!.account_id,
      avitag: req.user!.avitag,
      role: req.user!.role,
    });
    res.json({ success: true, data: { ticket } });
  },

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
    const id = req.params.id;
    const updated = await ModerationService.approveGist(id, req.user!.avitag ?? req.user!.account_id);
    if (!updated) return res.status(404).json({ success: false, message: 'Gist not found' });
    res.json({ success: true, data: updated });
  },

  rejectGist: async (req: Request, res: Response) => {
    const id = req.params.id;
    const { reason } = req.body || {};
    const updated = await ModerationService.rejectGist(id, req.user!.avitag ?? req.user!.account_id, reason ?? null);
    if (!updated) return res.status(404).json({ success: false, message: 'Gist not found' });
    res.json({ success: true, data: updated });
  },

  verifyProfile: async (req: Request, res: Response) => {
    const avitag = req.params.avitag;
    const updated = await ModerationService.verifyProfile(avitag, req.user!.avitag ?? req.user!.account_id);
    if (!updated) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: updated });
  },

  rejectProfile: async (req: Request, res: Response) => {
    const avitag = req.params.avitag;
    const { reason } = req.body || {};
    const result = await ModerationService.rejectProfile(avitag, req.user!.avitag ?? req.user!.account_id, reason ?? null);
    res.json({ success: true, data: result });
  },

  listPendingReports: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await ModerationService.listPendingReports(limit, offset);
    res.json({ success: true, data });
  },

  acceptReport: async (req: Request, res: Response) => {
    const { report_id } = req.params;
    try {
      const report = await ModerationService.acceptReport(report_id, req.user!.avitag ?? req.user!.account_id);
      return res.json({ success: true, data: report });
    } catch (err: any) {
      return res.status(safeErrorStatus(err, 400)).json({ success: false, message: safeErrorMessage(err, 'Unable to accept report') });
    }
  },

  rejectReport: async (req: Request, res: Response) => {
    const { report_id } = req.params;
    const row = await ModerationService.rejectReport(report_id, req.user!.avitag ?? req.user!.account_id);
    if (!row) return res.status(404).json({ success: false, message: 'Report not found or already reviewed' });
    return res.json({ success: true, data: row });
  },
};
