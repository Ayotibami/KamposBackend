import type { Request, Response } from 'express';
import * as accountRepo from '../account/account.repo';
import { safeAudit } from '../audit/audit.util';
import { notifyKingSecurity } from './kingSecurityPush';

// King-only admin roster management. Deliberately NOT gated by isIdiot —
// a plain idiot (granted admin) must not be able to grant/revoke other
// admins, only king can, so each handler checks req.user?.role === 'king'
// directly instead of going through the shared idiot/king middleware.
export const AdminsController = {
  list: async (req: Request, res: Response) => {
    if (req.user?.role !== 'king') {
      return res.status(403).json({ success: false, message: 'King access required' });
    }
    const data = await accountRepo.listAdminAccounts();
    return res.json({ success: true, data });
  },

  grant: async (req: Request, res: Response) => {
    if (req.user?.role !== 'king') {
      return res.status(403).json({ success: false, message: 'King access required' });
    }
    const { account_id } = req.body || {};
    if (!account_id) {
      return res.status(400).json({ success: false, message: 'account_id is required' });
    }
    const target = await accountRepo.findAccountById(account_id);
    if (!target) return res.status(404).json({ success: false, message: 'Account not found' });
    if (target.role === 'king') {
      notifyKingSecurity(`Blocked: an attempt to change a king's role via the admin route (${target.email})`);
      return res.status(400).json({ success: false, message: "Can't change king's role via this route" });
    }
    await accountRepo.updateAccountRole(account_id, 'idiot');
    // King may not have an active profile (avitag) set up at all — role,
    // not profile, is what makes king king, so account_id is a fine
    // fallback identity for the audit trail rather than blocking the
    // action on having a cosmetic profile.
    await safeAudit({ action: 'ADMIN_GRANT', target_type: 'ACCOUNT', target_id: account_id, idiot_avitag: req.user.avitag ?? req.user.account_id });
    notifyKingSecurity(`Admin access granted to ${target.email}`);
    return res.json({ success: true, message: 'Admin granted' });
  },

  revoke: async (req: Request, res: Response) => {
    if (req.user?.role !== 'king') {
      return res.status(403).json({ success: false, message: 'King access required' });
    }
    const { account_id } = req.body || {};
    if (!account_id) {
      return res.status(400).json({ success: false, message: 'account_id is required' });
    }
    const target = await accountRepo.findAccountById(account_id);
    if (!target) return res.status(404).json({ success: false, message: 'Account not found' });
    if (target.role === 'king') {
      notifyKingSecurity(`Blocked: an attempt to change a king's role via the admin route (${target.email})`);
      return res.status(400).json({ success: false, message: "Can't change king's role via this route" });
    }
    await accountRepo.updateAccountRole(account_id, 'user');
    await safeAudit({ action: 'ADMIN_REVOKE', target_type: 'ACCOUNT', target_id: account_id, idiot_avitag: req.user.avitag ?? req.user.account_id });
    notifyKingSecurity(`Admin access revoked from ${target.email}`);
    return res.json({ success: true, message: 'Admin revoked' });
  },
};
