import type { Request, Response } from 'express';
import * as repo from './repo';
import { uploadBuffer } from '../../../services/media/cloudinary';
import { env } from '../../../config/env';
import { sendWelcomeEmail } from '../../../services/email/profile';
import { isAdminRole } from '../../../middleware/idiot';
import { safeAudit } from '../../audit/audit.util';
import { notifyKingSecurity } from '../../idiot/kingSecurityPush';

export const create = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { avitag, display_name, campustag, description, image_url } = req.body || {};
  if (!avitag || !display_name) {
    return res.status(400).json({ success: false, message: 'avitag and display_name are required' });
  }
  let finalUrl: string | null = null;
  const filesAny = req.files as any;
  if (filesAny && filesAny.image) {
    const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
    const buffer: Buffer = file?.data;
    if (buffer) {
      const uploaded: any = await uploadBuffer(buffer, `kampos/profiles/${avitag}`);
      finalUrl = uploaded.secure_url || uploaded.url || null;
    }
  }
  if (!finalUrl && image_url) finalUrl = image_url;
  if (!finalUrl && env.DEFAULT_PROFILE_PIC_URL) finalUrl = env.DEFAULT_PROFILE_PIC_URL;

  const created = await repo.create({
    avitag,
    account_id: req.user.account_id,
    display_name,
    campustag: campustag ?? null,
    description: description ?? null,
    image_url: finalUrl ?? null,
  });
  void sendWelcomeEmail(req.user.account_id, { profile_type: 'KREATOR', display_name });
  return res.status(201).json({ success: true, data: created });
};

export const get = async (req: Request, res: Response) => {
  const p = await repo.findByAvitag(req.params.avitag);
  if (!p || p.profile_status !== 'ACTIVE' || (p.owner_account_status && p.owner_account_status !== 'ACTIVE')) {
    return res.status(404).json({ success: false, message: 'Profile not found' });
  }
  return res.json({ success: true, data: p });
};

export const list = async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);
  const data = await repo.listActive(limit, offset);
  return res.json({ success: true, data });
};

export const update = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const existing = await repo.findByAvitag(req.params.avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  const isAdmin = isAdminRole(req.user.role);
  if (existing.account_id !== req.user.account_id && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (existing.owner_role === 'king' && req.user.role !== 'king') {
    notifyKingSecurity(`Blocked: a non-king admin tried to edit king profile @${existing.avitag}`);
    return res.status(403).json({ success: false, message: "Can't edit a king's profile" });
  }
  if (existing.profile_status !== 'ACTIVE' && !isAdmin) {
    return res.status(403).json({ success: false, message: `This profile is ${existing.profile_status.toLowerCase()} and can't be edited right now` });
  }
  const updates: any = { ...req.body };
  const filesAny = req.files as any;
  if (filesAny && filesAny.image) {
    const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
    const buffer: Buffer = file?.data;
    if (buffer) {
      const uploaded: any = await uploadBuffer(buffer, `kampos/profiles/${existing.avitag}`);
      updates.image_url = uploaded.secure_url || uploaded.url || null;
    }
  }
  const updated = await repo.update(existing.avitag, existing.account_id, updates);
  if (!updated) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, data: updated });
};

export const verify = async (req: Request, res: Response) => {
  const ok = await repo.setVerified(req.params.avitag, true);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Verified' });
};

export const unverify = async (req: Request, res: Response) => {
  const ok = await repo.setVerified(req.params.avitag, false);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Unverified' });
};

export const remove = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const avitag = req.params.avitag;
  const existing = await repo.findByAvitag(avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  const isAdmin = isAdminRole(req.user.role);
  if (existing.account_id !== req.user.account_id && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (existing.owner_role === 'king' && req.user.role !== 'king') {
    notifyKingSecurity(`Blocked: a non-king admin tried to delete king profile @${existing.avitag}`);
    return res.status(403).json({ success: false, message: "Can't delete a king's profile" });
  }
  if (existing.profile_status === 'DELETED') {
    return res.status(400).json({ success: false, message: 'This profile is already deleted' });
  }
  const { reason } = req.body || {};
  const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  const ok = await repo.softDelete(avitag, cleanReason);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (isAdmin) {
    await safeAudit({
      action: 'PROFILE_DELETE',
      target_type: 'PROFILE',
      target_id: avitag,
      idiot_avitag: req.user.avitag ?? req.user.account_id,
      reason: cleanReason,
    });
  }
  return res.json({ success: true, message: 'Deleted' });
};

export const ban = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const existing = await repo.findByAvitag(avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (existing.owner_role === 'king' && req.user!.role !== 'king') {
    notifyKingSecurity(`Blocked: a non-king admin tried to ban king profile @${existing.avitag}`);
    return res.status(403).json({ success: false, message: "Can't ban a king's profile" });
  }
  if (existing.profile_status === 'DELETED') {
    return res.status(400).json({ success: false, message: "Can't ban a deleted profile" });
  }
  const { reason } = req.body || {};
  const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  const ok = await repo.setBanned(avitag, true, cleanReason);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  await safeAudit({
    action: 'PROFILE_BAN',
    target_type: 'PROFILE',
    target_id: avitag,
    idiot_avitag: req.user!.avitag ?? req.user!.account_id,
    reason: cleanReason,
  });
  return res.json({ success: true, message: 'Banned' });
};

export const unban = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const existing = await repo.findByAvitag(avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (existing.owner_role === 'king' && req.user!.role !== 'king') {
    notifyKingSecurity(`Blocked: a non-king admin tried to unban king profile @${existing.avitag}`);
    return res.status(403).json({ success: false, message: "Can't change a king's profile" });
  }
  if (existing.profile_status !== 'BANNED') {
    return res.status(400).json({ success: false, message: 'This profile is not banned' });
  }
  const ok = await repo.setBanned(avitag, false);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  await safeAudit({
    action: 'PROFILE_UNBAN',
    target_type: 'PROFILE',
    target_id: avitag,
    idiot_avitag: req.user!.avitag ?? req.user!.account_id,
  });
  return res.json({ success: true, message: 'Unbanned' });
};

export const deactivate = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const avitag = req.params.avitag;
  const existing = await repo.findByAvitag(avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (existing.account_id !== req.user.account_id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (existing.profile_status !== 'ACTIVE') {
    return res.status(400).json({ success: false, message: `This profile is ${existing.profile_status.toLowerCase()}, not active — nothing to deactivate` });
  }
  const ok = await repo.setDeactivated(avitag, true);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Deactivated' });
};

export const reactivate = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const avitag = req.params.avitag;
  const existing = await repo.findByAvitag(avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (existing.account_id !== req.user.account_id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (existing.profile_status !== 'DEACTIVATED') {
    return res.status(400).json({ success: false, message: "This profile isn't deactivated — nothing to reactivate" });
  }
  const ok = await repo.setDeactivated(avitag, false);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Reactivated' });
};
