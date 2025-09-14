import type { Request, Response } from 'express';
import * as mediaRepo from './media.repo';
import { uploadBuffer, deleteByPublicId } from '../../services/media/cloudinary';
import { WSGateway } from '../../ws/gateway';

export const GistMediaController = {
  upload: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const gist_id = req.params.gist_id;
    // Accept single file field 'file'
    const filesAny = req.files as any;
    const f = filesAny?.file ? (Array.isArray(filesAny.file) ? filesAny.file[0] : filesAny.file) : null;
    const buffer: Buffer | null = f?.data ?? null;
    if (!buffer) return res.status(400).json({ success: false, message: 'file required' });
    const uploaded: any = await uploadBuffer(buffer, `kampos/gists/${gist_id}`);
    const media_type: mediaRepo.MediaType = (uploaded.resource_type === 'video' ? 'VIDEO' : 'IMAGE');
    const media_url: string = uploaded.secure_url || uploaded.url;
    const thumbnail_url: string | null = uploaded?.thumbnail_url || uploaded?.eager?.[0]?.secure_url || null;
    const public_id: string | null = uploaded?.public_id || null;
    const saved = await mediaRepo.addMedia({ gist_id, media_type, media_url, thumbnail_url, public_id });
    try { WSGateway.broadcast('gist_media:created', { gist_id, media: saved }); } catch {}
    return res.status(201).json({ success: true, data: saved });
  },

  list: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    const media = await mediaRepo.listByGist(gist_id);
    return res.json({ success: true, data: media });
  },

  update: async (req: Request, res: Response) => {
    const media_id = req.params.media_id;
    const updated = await mediaRepo.updateMedia(media_id, req.body || {});
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    try { WSGateway.broadcast('gist_media:updated', { gist_id: updated.gist_id, media: updated }); } catch {}
    return res.json({ success: true, data: updated });
  },

  remove: async (req: Request, res: Response) => {
    const media_id = req.params.media_id;
    const existing = await mediaRepo.get(media_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.public_id) {
      try { await deleteByPublicId(existing.public_id); } catch { /* ignore delete errors */ }
    }
    const ok = await mediaRepo.remove(media_id);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    try { WSGateway.broadcast('gist_media:deleted', { gist_id: existing.gist_id, media_id }); } catch {}
    return res.json({ success: true, message: 'Deleted' });
  },
};
