import type { Request, Response } from 'express';
import * as gistsRepo from './gists.repo';

const VALID_STATUSES = new Set(['SUBMITTED', 'APPROVED', 'REJECTED']);

export const AdminGistsController = {
  // GET /idiot/gists — browse every gist regardless of status, the general
  // counterpart to the Group B moderation queue (which only ever surfaces a
  // gist while it's still SUBMITTED or reported). isAuth + isIdiot (any
  // admin, not king-only) — mounted in gists.routes.ts. Cursor-based
  // pagination, same scheme as gist.repo.ts's listByUser(): the cursor is
  // the last-seen gist's gist_id.
  list: async (req: Request, res: Response) => {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const status = statusRaw && VALID_STATUSES.has(statusRaw) ? (statusRaw as 'SUBMITTED' | 'APPROVED' | 'REJECTED') : null;
    const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : null;
    const campus_tag = typeof req.query.campus_tag === 'string' && req.query.campus_tag.trim() ? req.query.campus_tag.trim() : null;
    const avitag = typeof req.query.avitag === 'string' && req.query.avitag.trim() ? req.query.avitag.trim() : null;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = Number(req.query.limit ?? 20);

    const data = await gistsRepo.listAllGistsForAdmin({ status, search, campus_tag, avitag, cursor, limit });
    return res.json({ success: true, data });
  },
};
