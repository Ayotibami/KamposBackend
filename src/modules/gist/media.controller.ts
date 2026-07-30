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
    // Validate size/type: allow image/* up to 10MB, video/* up to 100MB
    const mimetype: string = f.mimetype || '';
    const size: number = typeof f.size === 'number' ? f.size : buffer.length;
    const isImage = mimetype.startsWith('image/');
    const isVideo = mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      return res.status(415).json({ success: false, message: 'Unsupported media type. Allowed: image/*, video/*' });
    }
    if (isImage && size > 10 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Image too large (max 10MB)' });
    }
    if (isVideo && size > 100 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Video too large (max 100MB)' });
    }
    const uploaded: any = await uploadBuffer(buffer, `kampos/gists/${gist_id}`, isVideo);
    const media_type: mediaRepo.MediaType = (uploaded.resource_type === 'video' ? 'VIDEO' : 'IMAGE');
    const media_url: string = uploaded.secure_url || uploaded.url;
    const thumbnail_url: string | null = uploaded?.thumbnail_url || uploaded?.eager?.[0]?.secure_url || null;
    const public_id: string | null = uploaded?.public_id || null;
    const saved = await mediaRepo.addMedia({ gist_id, media_type, media_url, thumbnail_url, public_id });
    try { WSGateway.broadcast('gist_media:created', { gist_id, media: saved }); } catch {}
    return res.status(201).json({ success: true, data: saved });
  },

  // POST /gists/:gist_id/media/url — attach a GIF/sticker (or any already-
  // hosted media) by URL, no file upload. Used by the Tenor picker: Tenor's
  // own terms expect integrators to hotlink their CDN, not re-host the
  // content, so this deliberately skips uploadBuffer/Cloudinary entirely —
  // public_id stays null since there's nothing on our own Cloudinary to
  // delete later if this media is removed.
  attachByUrl: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const gist_id = req.params.gist_id;
    const { media_url, thumbnail_url } = req.body || {};
    if (typeof media_url !== 'string' || !/^https:\/\//.test(media_url)) {
      return res.status(400).json({ success: false, message: 'A valid https media_url is required' });
    }
    const saved = await mediaRepo.addMedia({
      gist_id,
      media_type: 'IMAGE',
      media_url,
      thumbnail_url: typeof thumbnail_url === 'string' ? thumbnail_url : null,
      public_id: null,
    });
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

  reorder: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const gist_id = req.params.gist_id;
    const { media_ids } = req.body || {};
    if (!Array.isArray(media_ids) || media_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'media_ids array required' });
    }
    const updated = await mediaRepo.reorderMedia(gist_id, media_ids);
    try { WSGateway.broadcast('gist_media:reordered', { gist_id, media_ids }); } catch {}
    return res.json({ success: true, data: updated });
  },
};
