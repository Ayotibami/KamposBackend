import type { Request, Response } from 'express';
import * as spotsRepo from './spots.repo';
import * as SpotRepo from '../spot/spot.repo';
import { safeAudit } from '../audit/audit.util';
import { deleteByPublicIdWithType } from '../../services/media/cloudinary';

const VALID_STATUSES = new Set(['DRAFT', 'ACTIVE', 'REJECTED', 'REMOVED']);

export const AdminSpotsController = {
  // GET /idiot/spots — browse every Spot regardless of status. isAuth +
  // isIdiot (any admin, not king-only) — mounted in spots.routes.ts.
  // Cursor-based pagination, same scheme as idiot/gists.repo.ts's own
  // listAllGistsForAdmin: the cursor is the last-seen spot's spot_id. Total
  // is only computed on the first page (no cursor), same "N Spots" heading
  // trick the consumer profile grid already uses.
  list: async (req: Request, res: Response) => {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const status = statusRaw && VALID_STATUSES.has(statusRaw) ? (statusRaw as 'DRAFT' | 'ACTIVE' | 'REJECTED' | 'REMOVED') : null;
    const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : null;
    const avitag = typeof req.query.avitag === 'string' && req.query.avitag.trim() ? req.query.avitag.trim() : null;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = Number(req.query.limit ?? 20);

    const [data, total] = await Promise.all([
      spotsRepo.listAllSpotsForAdmin({ status, search, avitag, cursor, limit }),
      cursor ? Promise.resolve(undefined) : spotsRepo.countAllSpotsForAdmin({ status, search, avitag }),
    ]);
    return res.json({ success: true, data, ...(total !== undefined ? { total } : {}) });
  },

  // DELETE /idiot/spots/:spot_id — the genuine hard delete, separate from
  // the existing soft "Take Down" at DELETE /spots/:spot_id (spot.routes.ts,
  // which only ever flips status to REJECTED). Any admin, not king-only —
  // same gate as every other route in this module.
  hardDelete: async (req: Request, res: Response) => {
    const id = req.params.spot_id;
    const deleted = await SpotRepo.removeAsAdmin(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Spot not found' });
    // Best-effort, same as every other Cloudinary cleanup in this codebase
    // (see spot.controller.ts's own oversized-upload cleanup, or
    // gist.controller.ts's mirrored version of this exact fix) — a stuck
    // Cloudinary asset is a lesser problem than a moderation action that
    // fails/rolls back because Cloudinary happened to hiccup.
    if (deleted.public_id) {
      try {
        await deleteByPublicIdWithType(deleted.public_id, 'video');
      } catch {
        /* best-effort cleanup — the DB row is already gone, which is what actually matters */
      }
    }
    const { reason } = req.body || {};
    await safeAudit({
      action: 'SPOT_DELETE',
      target_type: 'SPOT',
      target_id: id,
      idiot_avitag: req.user!.avitag ?? req.user!.account_id,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null,
    });
    return res.json({ success: true, message: 'Deleted' });
  },

  // POST /idiot/spots/:spot_id/reactivate — undoes an admin's own Take Down
  // (see SpotRepo.reactivateAsAdmin's own doc for why this only reverses
  // REJECTED, never REMOVED). Any admin, not king-only.
  reactivate: async (req: Request, res: Response) => {
    const id = req.params.spot_id;
    const ok = await SpotRepo.reactivateAsAdmin(id);
    if (!ok) return res.status(404).json({ success: false, message: 'Spot not found or not currently taken down' });
    await safeAudit({
      action: 'SPOT_REACTIVATE',
      target_type: 'SPOT',
      target_id: id,
      idiot_avitag: req.user!.avitag ?? req.user!.account_id,
    });
    return res.json({ success: true, message: 'Reactivated' });
  },
};
