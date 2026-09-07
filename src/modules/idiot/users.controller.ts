import type { Request, Response } from 'express';
import { UsersService } from './users.service';
import * as accountRepo from '../account/account.repo';
import { notifyKingSecurity } from './kingSecurityPush';

const VALID_ROLES = new Set(['user', 'idiot', 'king']);
// Every status an admin can FILTER accounts by (used in search below) —
// wider than what an admin can actually SET via updateStatus (see
// SETTABLE_STATUSES), since DEACTIVATED is self-only but still a real
// account state worth being able to find.
const VALID_STATUSES = new Set(['ACTIVE', 'DEACTIVATED', 'DELETED', 'SUSPENDED']);
// What an admin's own status-mutating action (below) can target. Excludes
// DEACTIVATED — that's a self-only transition (see the per-type profile
// deactivate/reactivate routes' identical reasoning) — an admin never sets
// or clears it.
const SETTABLE_STATUSES = new Set(['ACTIVE', 'SUSPENDED', 'DELETED']);

export const UsersController = {
  // GET /idiot/users — account-level search/browse (one row per person).
  // isAuth + isIdiot (any admin). Filters are account-level only
  // (role/account_status/no_profile) — campus/major/profile_type were
  // removed once the product owner pointed out they made no sense on a
  // screen that no longer shows any per-profile detail; that's the Profiles
  // section's job now, one tab per type.
  search: async (req: Request, res: Response) => {
    const search = (req.query.search as string | undefined) || null;
    const roleRaw = req.query.role as string | undefined;
    const role = roleRaw && VALID_ROLES.has(roleRaw) ? (roleRaw as 'user' | 'idiot' | 'king') : null;
    const statusRaw = typeof req.query.account_status === 'string' ? req.query.account_status.toUpperCase() : undefined;
    const account_status = statusRaw && VALID_STATUSES.has(statusRaw) ? (statusRaw as 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'SUSPENDED') : null;
    const no_profile = req.query.no_profile === 'true' ? true : null;
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await UsersService.search({ search, role, account_status, no_profile, limit, offset });
    return res.json({ success: true, data });
  },

  // GET /idiot/users/:account_id — account detail: the account plus every
  // profile under it. isAuth + isIdiot (any admin).
  detail: async (req: Request, res: Response) => {
    const { account_id } = req.params;
    const data = await UsersService.getDetail(account_id);
    if (!data) return res.status(404).json({ success: false, message: 'Account not found' });
    return res.json({ success: true, data });
  },

  // POST /idiot/users — create an account on someone's behalf. isAuth +
  // isIdiot (any admin).
  create: async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }
    try {
      const account = await UsersService.createAccount(email, password, req.user!.avitag ?? req.user!.account_id);
      return res.status(201).json({ success: true, data: account });
    } catch (err: any) {
      if (err?.code === '23505') { // unique_violation
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }
      return res.status(500).json({ success: false, message: 'Failed to create account' });
    }
  },

  // PATCH /idiot/users/:account_id/email — king-only. Deliberately NOT
  // gated by isIdiot (see admins.controller.ts) — a plain idiot admin must
  // not be able to change anyone's email.
  updateEmail: async (req: Request, res: Response) => {
    if (req.user?.role !== 'king') {
      return res.status(403).json({ success: false, message: 'King access required' });
    }
    const { account_id } = req.params;
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }
    const target = await accountRepo.findAccountById(account_id);
    if (!target) return res.status(404).json({ success: false, message: 'Account not found' });
    try {
      const account = await UsersService.updateEmail(account_id, email, req.user.avitag ?? req.user.account_id);
      return res.json({ success: true, data: account });
    } catch (err: any) {
      if (err?.code === '23505') { // unique_violation
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }
      return res.status(500).json({ success: false, message: 'Failed to update email' });
    }
  },

  // PATCH /idiot/users/:account_id/status — any admin (isIdiot), NOT
  // king-only, matching how profile ban/delete already work. Handles
  // suspend/unsuspend/delete in one endpoint since they're the same
  // underlying write (see UsersService.updateStatus). Killing the target's
  // active sessions (revokeAllForAccount) happens inside the service, not
  // here — same split every other controller in this file uses.
  updateStatus: async (req: Request, res: Response) => {
    const { account_id } = req.params;
    const { status, reason } = req.body || {};
    if (typeof status !== 'string' || !SETTABLE_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'status must be one of ACTIVE, SUSPENDED, DELETED' });
    }
    const target = await accountRepo.findAccountById(account_id);
    if (!target) return res.status(404).json({ success: false, message: 'Account not found' });
    if (target.role === 'king') {
      notifyKingSecurity(`Blocked: an attempt to change a king's account status via the admin route (${target.email})`);
      return res.status(400).json({ success: false, message: "Can't change king's account status via this route" });
    }
    if (status === 'ACTIVE' && target.account_status !== 'SUSPENDED') {
      return res.status(400).json({ success: false, message: 'Only a suspended account can be unsuspended here' });
    }
    if (target.account_status === 'DELETED') {
      return res.status(400).json({ success: false, message: "This account is deleted — that can't be undone" });
    }
    const account = await UsersService.updateStatus(
      account_id,
      status as 'ACTIVE' | 'SUSPENDED' | 'DELETED',
      typeof reason === 'string' && reason.trim() ? reason.trim() : null,
      req.user!.avitag ?? req.user!.account_id,
    );
    return res.json({ success: true, data: account });
  },

  // POST /idiot/users/:account_id/email — any admin (isIdiot). A one-off
  // message, not a moderation action — no status change, no reason field
  // on the target row, just an email out plus an audit trail entry (see
  // UsersService.sendMessage) so a later admin can see one was sent and
  // what it was about.
  sendMessage: async (req: Request, res: Response) => {
    const { account_id } = req.params;
    const { subject, message } = req.body || {};
    if (typeof subject !== 'string' || !subject.trim() || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'subject and message are required' });
    }
    const target = await accountRepo.findAccountById(account_id);
    if (!target) return res.status(404).json({ success: false, message: 'Account not found' });
    try {
      await UsersService.sendMessage(
        account_id,
        target.email,
        subject.trim(),
        message.trim(),
        req.user!.avitag ?? req.user!.account_id,
      );
      return res.json({ success: true, message: 'Email sent' });
    } catch (err) {
      return res.status(502).json({ success: false, message: 'Failed to send the email — please try again' });
    }
  },
};
