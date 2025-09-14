import type { Request, Response } from 'express';
import * as repo from './repo';
import { uploadBuffer } from '../../../services/media/cloudinary';
import { env } from '../../../config/env';
import { sendWelcomeEmail } from '../../../services/email/profile';
import logger from '../../../utils/logger';

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
    return res.status(400).json({ success: false, message: err?.message || 'Unable to create student profile' });
  }
};

export const get = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const profile = await repo.findByAvitag(avitag);
  if (!profile || profile.profile_status !== 'ACTIVE') {
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
  if (existing.account_id !== req.user.account_id && req.user.role !== 'IDIOT') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
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

export const remove = async (req: Request, res: Response) => {
  const avitag = req.params.avitag;
  const ok = await repo.remove(avitag);
  if (!ok) return res.status(404).json({ success: false, message: 'Profile not found' });
  return res.json({ success: true, message: 'Deleted' });
};
