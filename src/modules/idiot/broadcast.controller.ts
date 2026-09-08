import type { Request, Response } from 'express';
import * as broadcastRepo from './broadcast.repo';
import { processPendingBroadcastRecipients } from './broadcastSender';
import { safeAudit } from '../audit/audit.util';
import logger from '../../utils/logger';

// King-only, checked directly (not via isIdiot) — same reasoning as
// admins.controller.ts's grant/revoke: a plain idiot admin granted admin
// powers should not be able to email every account on the platform.
function requireKing(req: Request, res: Response): boolean {
  if (req.user?.role !== 'king') {
    res.status(403).json({ success: false, message: 'King access required' });
    return false;
  }
  return true;
}

export const BroadcastController = {
  /** Lets the compose UI show "this will email N accounts" before the king
   * commits to sending anything. */
  recipientCount: async (req: Request, res: Response) => {
    if (!requireKing(req, res)) return;
    const recipients = await broadcastRepo.listActiveAccountEmails();
    res.json({ success: true, data: { count: recipients.length } });
  },

  list: async (req: Request, res: Response) => {
    if (!requireKing(req, res)) return;
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await broadcastRepo.listBroadcasts(limit, offset);
    res.json({ success: true, data });
  },

  get: async (req: Request, res: Response) => {
    if (!requireKing(req, res)) return;
    const data = await broadcastRepo.getBroadcast(req.params.broadcast_id);
    if (!data) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data });
  },

  create: async (req: Request, res: Response) => {
    if (!requireKing(req, res)) return;
    const { subject, message } = req.body || {};
    if (typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'subject is required' });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }
    const recipients = await broadcastRepo.listActiveAccountEmails();
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No active accounts to send to' });
    }
    const broadcast = await broadcastRepo.createBroadcast(
      subject.trim(),
      message.trim(),
      req.user!.account_id,
      recipients
    );
    await safeAudit({
      action: 'BROADCAST_CREATED',
      target_type: 'BROADCAST',
      target_id: broadcast.broadcast_id,
      idiot_avitag: req.user!.avitag ?? req.user!.account_id,
      reason: `"${broadcast.subject}" to ${recipients.length} accounts`,
    });
    // Fire the first batch immediately so sending starts right away rather
    // than waiting for the next scheduled tick (see index.ts) — that
    // recurring tick is still what carries a large/throttled broadcast the
    // rest of the way, this is purely for "don't make a small one wait".
    processPendingBroadcastRecipients().catch((err) => logger.error({ err }, 'Immediate broadcast send failed'));
    res.status(201).json({ success: true, data: { broadcast_id: broadcast.broadcast_id, total_recipients: recipients.length } });
  },
};
