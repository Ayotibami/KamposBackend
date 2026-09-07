import type { Request, Response } from 'express';
import * as repo from './repo';
import { uploadBuffer } from '../../../services/media/cloudinary';
import { env } from '../../../config/env';
import { sendWelcomeEmail } from '../../../services/email/profile';
import logger from '../../../utils/logger';
import { safeErrorMessage } from '../../../utils/errors';
import { isAdminRole } from '../../../middleware/idiot';
import { safeAudit } from '../../audit/audit.util';
import { notifyKingSecurity } from '../../idiot/kingSecurityPush';

export const create = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const {
    avitag,
    first_name,
    last_name,
    display_name,
    campus_tag,
    major_tag,
    level,
    bio,
    hobbies,
    degree,
    image_url,
  } = req.body || {};

  if (!avitag || !first_name || !last_name) {
    return res.status(400).json({ success: false, message: 'avitag, first_name, last_name are required' });
  }

  let finalImageUrl: string | null = null;
  // Prefer file upload if present
  const filesAny = req.files as any;
  if (filesAny && filesAny.image) {
    const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
    const buffer: Buffer = file?.data;
    if (buffer) {
      const uploaded: any = await uploadBuffer(buffer, `kampos/profiles/${avitag}`);
      finalImageUrl = uploaded.secure_url || uploaded.url || null;
    }
  }
  if (!finalImageUrl && image_url) finalImageUrl = image_url;
  if (!finalImageUrl && env.DEFAULT_PROFILE_PIC_URL) finalImageUrl = env.DEFAULT_PROFILE_PIC_URL;

  try {
    // Normalize hobbies: accept array, JSON string, or comma-separated string
    let hobbiesArr: string[] | null = null;
    if (Array.isArray(hobbies)) {
      hobbiesArr = hobbies as string[];
    } else if (typeof hobbies === 'string') {
      const text = hobbies.trim();
      if (text.startsWith('[')) {
        try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) hobbiesArr = parsed; } catch {}
      }
      if (!hobbiesArr) {
        hobbiesArr = text.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const created = await repo.create({
      avitag,
      account_id: req.user.account_id,
      first_name,
      last_name,
      display_name: display_name ?? null,
      campus_tag: campus_tag ?? null,
      major_tag: major_tag ?? null,
      level: level ?? null,
      bio: bio ?? null,
      hobbies: hobbiesArr ?? null,
      degree: degree ?? null,
      image_url: finalImageUrl ?? null,
    });
    // Fire-and-forget welcome email
    void sendWelcomeEmail(req.user.account_id, { profile_type: 'STUDENT', first_name, display_name });
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err?.code === '23503') {
      return res.status(400).json({ success: false, message: 'Invalid campus_tag or major_tag reference' });
    }
    return res.status(400).json({ success: false, message: safeErrorMessage(err, 'Unable to create student profile') });
  }
};

export const get = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const profile = await repo.findByAvitag(avitag);
  // AND-gate: a profile is only actually live if BOTH its own status AND
  // its owning account's status are ACTIVE — independent columns, neither
  // one overwrites the other (see repo.ts's own doc comment on
  // owner_account_status). Either one being off is enough to 404 it, same
  // as a plain not-found, for a random visitor — only the owner/admin
  // surfaces get the detailed reason (that's a separate, authenticated
  // lookup, not this public endpoint).
  if (
    !profile ||
    profile.profile_status !== 'ACTIVE' ||
    (profile.owner_account_status && profile.owner_account_status !== 'ACTIVE')
  ) {
    return res.status(404).json({ success: false, message: 'Profile not found' });
  }
  return res.json({ success: true, data: profile });
};

export const list = async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);
  const data = await repo.listActive(limit, offset);
  return res.json({ success: true, data });
};

export const update = async (req: Request, res: Response) => {
  if (!req.user?.account_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const avitag = req.params.avitag;

  // Only owner or IDIOT can update
  const existing = await repo.findByAvitag(avitag);
  if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });
  const isAdmin = isAdminRole(req.user.role);
  if (existing.account_id !== req.user.account_id && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  // Only a king can edit ANOTHER king's profile through the admin path — a
  // plain idiot admin editing their own profile is unaffected (that's the
  // ownership branch above, not this one; existing.account_id ===
  // req.user.account_id there means req.user.role already IS king if the
  // owner is king, so this only ever fires for a genuinely different,
  // non-king admin). Same guard as updateStatus already has at the
  // account level.
  if (existing.owner_role === 'king' && req.user.role !== 'king') {
    notifyKingSecurity(`Blocked: a non-king admin tried to edit king profile @${existing.avitag}`);
    return res.status(403).json({ success: false, message: "Can't edit a king's profile" });
  }
  // A banned/deactivated/deleted profile is frozen for its OWNER — an
  // admin can still edit regardless of status (matches the ownership
  // bypass above), same reasoning ban/deactivate exist for in the first
  // place: an owner shouldn't be able to keep editing something an admin
  // (or they themselves) just took offline.
  if (existing.profile_status !== 'ACTIVE' && !isAdmin) {
    return res.status(403).json({ success: false, message: `This profile is ${existing.profile_status.toLowerCase()} and can't be edited right now` });
  }

  const updates: any = { ...req.body };
  // Normalize hobbies on update similarly
  if (updates.hobbies !== undefined) {
    if (Array.isArray(updates.hobbies)) {
      // ok
    } else if (typeof updates.hobbies === 'string') {
      const text = updates.hobbies.trim();
      let arr: string[] | null = null;
      if (text.startsWith('[')) {
        try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) arr = parsed; } catch {}
      }
      if (!arr) arr = text.split(',').map((s: string) => s.trim()).filter(Boolean);
      updates.hobbies = arr;
    }
  }
  // If a new image file is supplied, upload it and set image_url
  const filesAny = req.files as any;
  if (filesAny && filesAny.image) {
    const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
    const buffer: Buffer = file?.data;
    if (buffer) {
      const uploaded: any = await uploadBuffer(buffer, `kampos/profiles/${avitag}`);
      updates.image_url = uploaded.secure_url || uploaded.url || null;
    }
  }

  const updated = await repo.update(avitag, existing.account_id, updates);
  if (!updated) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, data: updated });
};

export const verify = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const ok = await repo.setVerified(avitag, true);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Verified' });
};

export const unverify = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const ok = await repo.setVerified(avitag, false);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Unverified' });
};

// Either the owner or an admin can delete — same "either actor" symmetry
// as account-level delete. Soft (see repo.softDelete's own doc comment):
// terminal for everyone once it happens, but the row/content stays.
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
  const ok = await repo.softDelete(avitag, typeof reason === 'string' && reason.trim() ? reason.trim() : null);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (isAdmin) {
    await safeAudit({
      action: 'PROFILE_DELETE',
      target_type: 'PROFILE',
      target_id: avitag,
      idiot_avitag: req.user.avitag ?? req.user.account_id,
      reason: typeof reason === 'string' ? reason : null,
    });
  }
  return res.json({ success: true, message: 'Deleted' });
};

// Admin only, both directions — an owner has no control over this state.
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

// Self-only, both directions — strict ownership, no admin bypass (this is
// the one place admins should never be allowed in, per the agreed model:
// an admin who wants to take a profile offline uses ban, not this).
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
