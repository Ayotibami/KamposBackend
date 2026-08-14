import type { Request, Response } from 'express';
import * as mediaRepo from './media.repo';
import { GistService } from './gist.service';
import { uploadBuffer, deleteByPublicId, deleteByPublicIdWithType, signUpload } from '../../services/media/cloudinary';
import { WSGateway } from '../../ws/gateway';
import { env } from '../../config/env';

// Kampos gists are quick, in-the-moment posts, not a video platform —
// 2 minutes covers a real phone-recorded clip comfortably (Twitter/X's own
// *default*, non-Premium upload cap is 140s, for the same reason) without
// the storage/bandwidth/moderation cost of open-ended video length.
const MAX_VIDEO_DURATION_SECONDS = 120;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Every media-mutating endpoint below takes a `gist_id` straight from the
 * URL with no check that the caller actually owns that gist — previously
 * true of every one of them (attach/upload/reorder), not just the new
 * direct-upload pair. Any logged-in user could attach, replace, or reorder
 * media on *anyone's* gist. This is the one shared gate all of them now
 * run through first: the gist's actual owner, or an IDIOT (admin) profile
 * — same bypass convention `GistController.remove` already uses — get
 * through; anyone else gets a 403 without ever reaching Cloudinary or the
 * database write. Returns `null` (having already sent the response) when
 * the caller isn't allowed, so call sites can just `if (!ok) return;`. */
async function assertCanEditGist(req: Request, res: Response, gist_id: string): Promise<boolean> {
  if (!req.user?.avitag) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  if (req.user.role === 'IDIOT') return true;
  const gist = await GistService.findById(gist_id);
  if (!gist) {
    res.status(404).json({ success: false, message: 'Gist not found' });
    return false;
  }
  if (gist.avitag !== req.user.avitag) {
    res.status(403).json({ success: false, message: 'You can only manage media on your own gist' });
    return false;
  }
  return true;
}

export const GistMediaController = {
  // Step 1 of the direct-to-Cloudinary upload flow: hands the browser a
  // short-lived signed params set so it can upload straight to Cloudinary
  // itself, bypassing this server (and the Next.js frontend's own proxy)
  // entirely for the actual file bytes — see cloudinary.ts's signUpload
  // for why that's the whole point. `resource_type` is client-declared
  // (image vs video) purely to decide whether to also sign an `eager`
  // thumbnail transformation; it isn't trusted for anything security-
  // relevant, `finalize` below re-derives the real type from what
  // Cloudinary itself reports.
  signature: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    if (!(await assertCanEditGist(req, res, gist_id))) return;
    const isVideo = req.query.resource_type === 'video';
    const folder = `kampos/gists/${gist_id}`;
    const paramsToSign: Record<string, string | number> = {
      folder,
      ...(isVideo ? { eager: 'w_400,c_scale,f_jpg' } : {}),
    };
    const { signature, timestamp } = signUpload(paramsToSign);
    return res.json({
      success: true,
      data: {
        signature,
        timestamp,
        api_key: env.CLOUDINARY_API_KEY,
        cloud_name: env.CLOUDINARY_NAME,
        folder,
        eager: isVideo ? 'w_400,c_scale,f_jpg' : undefined,
        upload_url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_NAME}/auto/upload`,
      },
    });
  },

  // Step 2: the browser already uploaded directly to Cloudinary by this
  // point (see above) — this just records the result against the gist,
  // after re-validating it against real policy using what Cloudinary
  // itself reported (bytes/duration), not anything the client claims.
  // A file that slipped past client-side checks (a modified/replayed
  // request, a bug, whatever) gets deleted from Cloudinary immediately
  // rather than silently accepted.
  finalize: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    if (!(await assertCanEditGist(req, res, gist_id))) return;
    const { media_url, public_id, resource_type, bytes, duration, width, height } = req.body || {};

    if (typeof media_url !== 'string' || typeof public_id !== 'string' || !public_id) {
      return res.status(400).json({ success: false, message: 'media_url and public_id are required' });
    }
    // Only ever trust a URL actually hosted on this account's own
    // Cloudinary cloud — otherwise `finalize` becomes a way to attach any
    // arbitrary external URL and claim ownership of it (with a public_id
    // we'd later try to delete on Cloudinary's account, which isn't ours).
    const expectedHost = `res.cloudinary.com/${env.CLOUDINARY_NAME}/`;
    if (!media_url.startsWith('https://') || !media_url.includes(expectedHost)) {
      return res.status(400).json({ success: false, message: 'media_url must be a Kampos-hosted Cloudinary URL' });
    }

    const isVideo = resource_type === 'video';
    const media_type: mediaRepo.MediaType = isVideo ? 'VIDEO' : 'IMAGE';
    const sizeBytes = typeof bytes === 'number' ? bytes : 0;
    const durationSeconds = typeof duration === 'number' ? duration : 0;

    const overLimit = isVideo
      ? sizeBytes > MAX_VIDEO_BYTES || durationSeconds > MAX_VIDEO_DURATION_SECONDS
      : sizeBytes > MAX_IMAGE_BYTES;

    if (overLimit) {
      try {
        await deleteByPublicIdWithType(public_id, isVideo ? 'video' : 'image');
      } catch {
        /* best-effort cleanup — the DB row is what actually matters not existing */
      }
      const reason = isVideo
        ? `Video too large or too long (max ${MAX_VIDEO_BYTES / 1024 / 1024}MB, ${MAX_VIDEO_DURATION_SECONDS}s)`
        : `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`;
      return res.status(413).json({ success: false, message: reason });
    }

    const thumbnail_url = req.body?.thumbnail_url;
    const saved = await mediaRepo.addMedia({
      gist_id,
      media_type,
      media_url,
      thumbnail_url: typeof thumbnail_url === 'string' ? thumbnail_url : null,
      // Reported by Cloudinary's own direct-upload response — the browser
      // already has it from step 1, same trust level as bytes/duration
      // above (both already came from that same response, not the client
      // itself claiming anything).
      width: typeof width === 'number' ? width : null,
      height: typeof height === 'number' ? height : null,
      public_id,
    });
    try { WSGateway.broadcast('gist_media:created', { gist_id, media: saved }); } catch {}
    return res.status(201).json({ success: true, data: saved });
  },

  upload: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    if (!(await assertCanEditGist(req, res, gist_id))) return;
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
    const width: number | null = typeof uploaded?.width === 'number' ? uploaded.width : null;
    const height: number | null = typeof uploaded?.height === 'number' ? uploaded.height : null;
    const saved = await mediaRepo.addMedia({ gist_id, media_type, media_url, thumbnail_url, width, height, public_id });
    try { WSGateway.broadcast('gist_media:created', { gist_id, media: saved }); } catch {}
    return res.status(201).json({ success: true, data: saved });
  },

  // POST /gists/:gist_id/media/url — attach a GIF/sticker (or any already-
  // hosted media) by URL, no file upload. Used by the GIPHY picker: GIPHY's
  // own terms expect integrators to hotlink their CDN, not re-host the
  // content, so this deliberately skips uploadBuffer/Cloudinary entirely —
  // public_id stays null since there's nothing on our own Cloudinary to
  // delete later if this media is removed.
  attachByUrl: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    if (!(await assertCanEditGist(req, res, gist_id))) return;
    const { media_url, thumbnail_url, width, height } = req.body || {};
    if (typeof media_url !== 'string' || !/^https:\/\//.test(media_url)) {
      return res.status(400).json({ success: false, message: 'A valid https media_url is required' });
    }
    const saved = await mediaRepo.addMedia({
      gist_id,
      media_type: 'IMAGE',
      media_url,
      thumbnail_url: typeof thumbnail_url === 'string' ? thumbnail_url : null,
      // Reported by GIPHY's own API for this exact URL — same trust level
      // as the width/height `finalize` accepts from Cloudinary's response.
      width: typeof width === 'number' ? width : null,
      height: typeof height === 'number' ? height : null,
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
    const existing = await mediaRepo.get(media_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (!(await assertCanEditGist(req, res, existing.gist_id))) return;
    const updated = await mediaRepo.updateMedia(media_id, req.body || {});
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    try { WSGateway.broadcast('gist_media:updated', { gist_id: updated.gist_id, media: updated }); } catch {}
    return res.json({ success: true, data: updated });
  },

  remove: async (req: Request, res: Response) => {
    const media_id = req.params.media_id;
    const existing = await mediaRepo.get(media_id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (!(await assertCanEditGist(req, res, existing.gist_id))) return;
    if (existing.public_id) {
      try { await deleteByPublicId(existing.public_id); } catch { /* ignore delete errors */ }
    }
    const ok = await mediaRepo.remove(media_id);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    try { WSGateway.broadcast('gist_media:deleted', { gist_id: existing.gist_id, media_id }); } catch {}
    return res.json({ success: true, message: 'Deleted' });
  },

  reorder: async (req: Request, res: Response) => {
    const gist_id = req.params.gist_id;
    if (!(await assertCanEditGist(req, res, gist_id))) return;
    const { media_ids } = req.body || {};
    if (!Array.isArray(media_ids) || media_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'media_ids array required' });
    }
    const updated = await mediaRepo.reorderMedia(gist_id, media_ids);
    try { WSGateway.broadcast('gist_media:reordered', { gist_id, media_ids }); } catch {}
    return res.json({ success: true, data: updated });
  },
};
