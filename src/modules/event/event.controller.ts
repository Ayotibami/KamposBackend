import type { Request, Response } from 'express';
import * as EventRepo from './event.repo';
import { uploadBuffer } from '../../services/media/cloudinary';
import { WSGateway } from '../../ws/gateway';
import { getCampusMajor } from '../profile/utils';

export const EventController = {
  create: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Parse body fields (works for JSON or multipart/form-data)
    const { title, location, description, event_date } = req.body || {};
    let host_avi_tags: string[] = [];
    try {
      const raw = req.body?.host_avi_tags;
      if (Array.isArray(raw)) host_avi_tags = raw as string[];
      else if (typeof raw === 'string') {
        try { host_avi_tags = JSON.parse(raw); } catch { host_avi_tags = raw.split(',').map((s) => s.trim()).filter(Boolean); }
      }
      if (!host_avi_tags.length) host_avi_tags = [req.user.avitag];
      if (host_avi_tags.length > 3) return res.status(400).json({ success: false, message: 'host_avi_tags max 3' });
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid host_avi_tags' });
    }

    // Optional thumbnail from form-data field 'thumbnail'
    let thumbnail_url: string | null = null;
    const filesAny = req.files as any;
    const thumb = filesAny?.thumbnail ? (Array.isArray(filesAny.thumbnail) ? filesAny.thumbnail[0] : filesAny.thumbnail) : null;
    if (thumb && thumb.data) {
      const buffer: Buffer = thumb.data;
      const mimetype: string = thumb.mimetype || '';
      const size: number = typeof thumb.size === 'number' ? thumb.size : buffer.length;
      const isImage = mimetype.startsWith('image/');
      if (!isImage) return res.status(415).json({ success: false, message: 'Thumbnail must be an image' });
      if (size > 10 * 1024 * 1024) return res.status(413).json({ success: false, message: 'Thumbnail too large (max 10MB)' });
      const uploaded: any = await uploadBuffer(buffer, `kampos/events`);
      thumbnail_url = uploaded?.secure_url || uploaded?.url || null;
    }

    const { campus_tag, major_tag } = await getCampusMajor(req.user.avitag);
    const ev = await EventRepo.create({
      title,
      host_avi_tags,
      location,
      description,
      event_date: new Date(event_date),
      thumbnail_url,
      campus_tag,
      major_tag,
    });
    try { WSGateway.broadcast('event.created', { event: ev }); } catch {}
    return res.status(201).json({ success: true, data: ev });
  },

  list: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const data = await EventRepo.list(limit, before);
    return res.json({ success: true, data });
  },

  get: async (req: Request, res: Response) => {
    const { event_id } = req.params;
    const row = await EventRepo.findById(event_id);
    if (!row) return res.status(404).json({ success: false, message: 'Event not found' });
    return res.json({ success: true, data: row });
  },

  update: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { event_id } = req.params;
    const patch: any = {};
    for (const k of ['title','host_avi_tags','location','description','event_date','thumbnail_url']) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (patch.event_date) patch.event_date = new Date(patch.event_date);
    const updated = await EventRepo.update(event_id, patch);
    if (!updated) return res.status(404).json({ success: false, message: 'Event not found' });
    try { WSGateway.broadcast('event.updated', { event: updated }); } catch {}
    return res.json({ success: true, data: updated });
  },

  remove: async (req: Request, res: Response) => {
    const { event_id } = req.params;
    const ok = await EventRepo.remove(event_id);
    if (!ok) return res.status(404).json({ success: false, message: 'Event not found' });
    try { WSGateway.broadcast('event.deleted', { event_id }); } catch {}
    return res.json({ success: true, message: 'Deleted' });
  },

  view: async (req: Request, res: Response) => {
    const { event_id } = req.params;
    await EventRepo.incrementView(event_id, req.user?.avitag ?? null);
    try { WSGateway.broadcast('event.viewed', { event_id, by: req.user?.avitag ?? null }); } catch {}
    return res.json({ success: true });
  },
};
