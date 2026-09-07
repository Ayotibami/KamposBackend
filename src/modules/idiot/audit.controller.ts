import type { Request, Response } from 'express';
import { listAuditLogs, type AuditAction } from '../audit/audit.repo';

const VALID_ACTIONS = new Set<AuditAction>([
  'PROFILE_VERIFY',
  'PROFILE_REJECT',
  'PROFILE_BAN',
  'PROFILE_UNBAN',
  'PROFILE_DELETE',
  'PROFILE_CREATE',
  'GIST_APPROVE',
  'GIST_REJECT',
  'REPORT_ACCEPT',
  'REPORT_REJECT',
  'ADMIN_GRANT',
  'ADMIN_REVOKE',
  'GIST_DELETE',
  'COMMENT_DELETE',
  'USER_CREATE',
  'USER_EMAIL_EDIT',
  'ACCOUNT_SUSPEND',
  'ACCOUNT_UNSUSPEND',
  'ACCOUNT_DELETE',
  'ADMIN_EMAIL_SENT',
  'REFERENCE_CREATE',
  'REFERENCE_UPDATE',
  'REFERENCE_DELETE',
]);

export const AuditController = {
  // GET /idiot/audit — king-only (see this controller's own inline check,
  // same "no isIdiot middleware, role checked here" pattern
  // users.controller.ts's updateEmail already uses): a plain 'idiot' admin
  // must not be able to see who's doing what, since the whole point of this
  // screen is oversight OVER admins, not a browsable feed every admin gets
  // to watch (see the actual conversation that settled this — an audit log
  // any admin can read stops functioning as a check on admin behavior).
  list: async (req: Request, res: Response) => {
    if (req.user?.role !== 'king') {
      return res.status(403).json({ success: false, message: 'King access required' });
    }
    const actionRaw = typeof req.query.action === 'string' ? req.query.action : undefined;
    const action = actionRaw && VALID_ACTIONS.has(actionRaw as AuditAction) ? (actionRaw as AuditAction) : null;
    const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : null;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
    const limit = Number(req.query.limit ?? 30);

    const data = await listAuditLogs({ action, search, cursor, limit });
    return res.json({ success: true, data });
  },
};
