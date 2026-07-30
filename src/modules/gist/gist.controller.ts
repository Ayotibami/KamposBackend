import type { Request, Response } from "express";
import { GistService } from './gist.service';
import { WSGateway } from '../../ws/gateway';
import { env } from '../../config/env';
import * as ProfileUtils from '../profile/utils';
import * as GistMediaRepo from './media.repo';
import { uploadBuffer } from '../../services/media/cloudinary';

export const GistController = {
  create: async (req: Request, res: Response) => {
    if (!req.user?.avitag) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Active profile (avitag) is required. Switch profile and retry.",
        });
    }
    const { gist_text } = req.body || {};
    const profile = await ProfileUtils.findByAvitag(req.user.avitag);
    const isVerified = !!profile?.is_verified;
    const maxLen = isVerified ? env.VERIFIED_GIST_MAX : env.UNVERIFIED_GIST_MAX;
    if (typeof gist_text !== 'string' || gist_text.length < 1) {
      return res.status(400).json({ success: false, message: 'gist_text is required' });
    }
    if (gist_text.length > maxLen) {
      return res.status(400).json({ success: false, message: `gist_text exceeds limit (${maxLen} chars for ${isVerified ? 'verified' : 'unverified'} profiles)` });
    }
    // Compose profile_id as avitag:account_id
    const profile_id = `${req.user.avitag}:${req.user.account_id}`;
    const gist = await GistService.create(
      req.user.avitag,
      req.user.account_id,
      profile_id,
      req.user.profileType || '',
      gist_text
    );

    // If files are provided (multipart/form-data), upload and attach as media
    try {
      const filesAny = req.files as any;
      // Support either 'file' (single) or 'files' (array). express-fileupload maps both to objects or arrays
      let inputs: Array<{ name: string; data: Buffer; mimetype: string; size: number }> = [];
      const single = filesAny?.file;
      const multi = filesAny?.files;
      if (single) {
        const arr = Array.isArray(single) ? single : [single];
        inputs.push(
          ...arr.map((f: any) => ({
            name: f.name as string,
            data: f.data as Buffer,
            mimetype: String(f.mimetype || ''),
            size: typeof f.size === 'number' ? f.size as number : (f.data?.length || 0),
          }))
        );
      }
      if (multi) {
        const arr = Array.isArray(multi) ? multi : [multi];
        inputs.push(
          ...arr.map((f: any) => ({
            name: f.name as string,
            data: f.data as Buffer,
            mimetype: String(f.mimetype || ''),
            size: typeof f.size === 'number' ? f.size as number : (f.data?.length || 0),
          }))
        );
      }

      if (inputs.length) {
        // Validate each file: image/* up to 10MB, video/* up to 100MB
        for (const f of inputs) {
          const isImage = f.mimetype.startsWith('image/');
          const isVideo = f.mimetype.startsWith('video/');
          if (!isImage && !isVideo) {
            return res.status(415).json({ success: false, message: 'Unsupported media type. Allowed: image/*, video/*' });
          }
          if (isImage && f.size > 10 * 1024 * 1024) {
            return res.status(413).json({ success: false, message: `Image ${f.name} too large (max 10MB)` });
          }
          if (isVideo && f.size > 100 * 1024 * 1024) {
            return res.status(413).json({ success: false, message: `Video ${f.name} too large (max 100MB)` });
          }
        }

        // Upload in sequence to preserve order_index
        let idx = 0;
        for (const f of inputs) {
          const isVideo = f.mimetype.startsWith('video/');
          const uploaded: any = await uploadBuffer(f.data, `kampos/gists/${gist.gist_id}`, isVideo);
          const media_type: GistMediaRepo.MediaType = uploaded?.resource_type === 'video' ? 'VIDEO' : 'IMAGE';
          const media_url: string = uploaded?.secure_url || uploaded?.url;
          const thumbnail_url: string | null = uploaded?.thumbnail_url || uploaded?.eager?.[0]?.secure_url || null;
          const public_id: string | null = uploaded?.public_id || null;
          const saved = await GistMediaRepo.addMedia({
            gist_id: gist.gist_id,
            media_type,
            media_url,
            thumbnail_url,
            order_index: idx,
            public_id,
          });
          idx += 1;
          try { WSGateway.broadcast('gist_media:created', { gist_id: gist.gist_id, media: saved }); } catch {}
        }
      }
    } catch (e) {
      // Do not fail the request if media upload fails; return gist data
      // Optionally, log error here
    }

    // Fetch the gist with media aggregated so client gets media inline
    try {
      const full = await GistService.findWithCountsAnyStatus?.(gist.gist_id as any, req.user?.avitag);
      if (full) return res.status(201).json({ success: true, data: full });
    } catch {}
    return res.status(201).json({ success: true, data: { ...gist, media: [] } });
  },

  counts: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    const counts = await GistService.getCounts(id);
    if (!counts) return res.status(404).json({ success: false, message: 'Gist not found' });
    return res.json({ success: true, data: counts });
  },

  get: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    // Fetch regardless of status
    let gistAny = await GistService.findWithCounts(id, req.user?.avitag);
    if (gistAny) {
      // Populate profile object using avitag and account_id
      let profile = await ProfileUtils.findByAvitag(gistAny.avitag);
      if (profile && profile.profile_type) {
        try {
          let fullProfile = null;
          switch (profile.profile_type) {
            case 'STUDENT':
              fullProfile = await (await import('../profile/students/repo')).findByAvitag(gistAny.avitag);
              break;
            case 'KREATOR':
              fullProfile = await (await import('../profile/kreators/repo')).findByAvitag(gistAny.avitag);
              break;
            case 'KOMPANY':
              fullProfile = await (await import('../profile/kompanies/repo')).findByAvitag(gistAny.avitag);
              break;
            case 'SCHOOL':
              fullProfile = await (await import('../profile/schools/repo')).findByAvitag(gistAny.avitag);
              break;
            case 'IDIOT':
              fullProfile = await (await import('../profile/idiots/repo')).findByAvitag(gistAny.avitag);
              break;
            default:
              fullProfile = profile;
          }
          (gistAny as any).profile = fullProfile || profile;
        } catch {
          (gistAny as any).profile = profile;
        }
      } else {
        (gistAny as any).profile = profile;
      }
      const viewer = req.user?.avitag ?? null;
      await GistService.incrementView(id, viewer);
      WSGateway.broadcast('gist:viewed', { gist_id: id, by: viewer });
      try {
        const countsFull = await GistService.getCountsFull(id);
        WSGateway.broadcast('counts:updated', { gist_id: id, ...countsFull });
      } catch {}
      return res.json({ success: true, data: gistAny });
    }
    // If not found among APPROVED, try any status and allow owner/IDIOT access
    let full = await GistService.findWithCountsAnyStatus?.(id as any, req.user?.avitag);
    if (!full) return res.status(404).json({ success: false, message: 'Gist not found' });
    // Populate profile object using avitag and account_id
    let profile = await ProfileUtils.findByAvitag(full.avitag);
    if (profile && profile.profile_type) {
      try {
        let fullProfile = null;
        switch (profile.profile_type) {
          case 'STUDENT':
            fullProfile = await (await import('../profile/students/repo')).findByAvitag(full.avitag);
            break;
          case 'KREATOR':
            fullProfile = await (await import('../profile/kreators/repo')).findByAvitag(full.avitag);
            break;
          case 'KOMPANY':
            fullProfile = await (await import('../profile/kompanies/repo')).findByAvitag(full.avitag);
            break;
          case 'SCHOOL':
            fullProfile = await (await import('../profile/schools/repo')).findByAvitag(full.avitag);
            break;
          case 'IDIOT':
            fullProfile = await (await import('../profile/idiots/repo')).findByAvitag(full.avitag);
            break;
          default:
            fullProfile = profile;
        }
        (full as any).profile = fullProfile || profile;
      } catch {
        (full as any).profile = profile;
      }
    } else {
      (full as any).profile = profile;
    }
    const isOwner = req.user?.avitag && req.user.avitag === full.avitag;
    const isAdmin = req.user?.role === 'IDIOT';
    if (isOwner || isAdmin) {
      const viewer = req.user?.avitag ?? null;
      await GistService.incrementView(id, viewer);
      WSGateway.broadcast('gist:viewed', { gist_id: id, by: viewer });
      try {
        const countsFull = await GistService.getCountsFull(id);
        WSGateway.broadcast('counts:updated', { gist_id: id, ...countsFull });
      } catch {}
      return res.json({ success: true, data: full });
    }
    return res.status(404).json({ success: false, message: 'Gist not found' });
  },

  list: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const viewerAvitag = req.user?.avitag;
    const campus_tag = typeof req.query.campus_tag === 'string' ? req.query.campus_tag : undefined;
    const major_tag = typeof req.query.major_tag === 'string' ? req.query.major_tag : undefined;
    const data = await GistService.listRecent(limit, cursor, viewerAvitag, { campus_tag: campus_tag ?? null, major_tag: major_tag ?? null });
    // Populate profile for each gist
    await Promise.all(data.map(async (g: any) => {
      let profile = await ProfileUtils.findByAvitag(g.avitag);
      if (profile && profile.profile_type) {
        try {
          let fullProfile = null;
          switch (profile.profile_type) {
            case 'STUDENT':
              fullProfile = await (await import('../profile/students/repo')).findByAvitag(g.avitag);
              break;
            case 'KREATOR':
              fullProfile = await (await import('../profile/kreators/repo')).findByAvitag(g.avitag);
              break;
            case 'KOMPANY':
              fullProfile = await (await import('../profile/kompanies/repo')).findByAvitag(g.avitag);
              break;
            case 'SCHOOL':
              fullProfile = await (await import('../profile/schools/repo')).findByAvitag(g.avitag);
              break;
            case 'IDIOT':
              fullProfile = await (await import('../profile/idiots/repo')).findByAvitag(g.avitag);
              break;
            default:
              fullProfile = profile;
          }
          g.profile = fullProfile || profile;
        } catch {
          g.profile = profile;
        }
      } else {
        g.profile = profile;
      }
    }));
    // Increment views for all returned gists and notify via WS
    const viewer = req.user?.avitag ?? null;
    try {
      await Promise.all(
        data.map((g: any) => GistService.incrementView(g.gist_id, viewer))
      );
      WSGateway.broadcast('gist:viewed_batch', {
        gist_ids: data.map((g: any) => g.gist_id),
        by: viewer,
      });
      // Emit counts for each gist in batch
      const countsAll = await Promise.all(
        data.map((g: any) => GistService.getCountsFull(g.gist_id))
      );
      data.forEach((g: any, idx: number) =>
        WSGateway.broadcast('counts:updated', { gist_id: g.gist_id, ...countsAll[idx] })
      );
    } catch {}
    return res.json({ success: true, data });
  },

  update: async (req: Request, res: Response) => {
    if (!req.user?.avitag)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.gist_id;
    const { gist_text } = req.body || {};
    if (typeof gist_text !== 'string' || gist_text.length < 1) {
      return res.status(400).json({ success: false, message: 'gist_text is required' });
    }
    // Same cap `create` enforces — an edit shouldn't be able to slip past
    // the limit just because only the create path used to check it.
    const profile = await ProfileUtils.findByAvitag(req.user.avitag);
    const isVerified = !!profile?.is_verified;
    const maxLen = isVerified ? env.VERIFIED_GIST_MAX : env.UNVERIFIED_GIST_MAX;
    if (gist_text.length > maxLen) {
      return res.status(400).json({ success: false, message: `gist_text exceeds limit (${maxLen} chars for ${isVerified ? 'verified' : 'unverified'} profiles)` });
    }
    const updated = await GistService.updateText(
      id,
      req.user.avitag,
      gist_text
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Gist not found or forbidden" });
    return res.json({ success: true, data: updated });
  },

  remove: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    if (req.user?.role === "IDIOT") {
      const ok = await GistService.deleteAsIdiot(id);
      if (!ok)
        return res
          .status(404)
          .json({ success: false, message: "Gist not found" });
      return res.json({ success: true, message: "Deleted" });
    }
    if (!req.user?.avitag)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const ok = await GistService.deleteByOwner(id, req.user.avitag);
    if (!ok)
      return res
        .status(404)
        .json({ success: false, message: "Gist not found or forbidden" });
    return res.json({ success: true, message: "Deleted" });
  },

  byUser: async (req: Request, res: Response) => {
    const avitag = req.params.avitag;
    const limit = Number(req.query.limit ?? 20);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const viewerAvitag = req.user?.avitag;
    const data = await GistService.listByUser(avitag, limit, cursor, viewerAvitag);
    const viewer = req.user?.avitag ?? null;
    try {
      await Promise.all(data.map((g: any) => GistService.incrementView(g.gist_id, viewer)));
      WSGateway.broadcast('gist:viewed_batch', { gist_ids: data.map((g: any) => g.gist_id), by: viewer });
      const countsAll = await Promise.all(
        data.map((g: any) => GistService.getCountsFull(g.gist_id))
      );
      data.forEach((g: any, idx: number) =>
        WSGateway.broadcast('counts:updated', { gist_id: g.gist_id, ...countsAll[idx] })
      );
    } catch {}
    return res.json({ success: true, data });
  },

  trending: async (req: Request, res: Response) => {
    const viewerAvitag = req.user?.avitag;
    const campus_tag = typeof req.query.campus_tag === 'string' ? req.query.campus_tag : undefined;
    const major_tag = typeof req.query.major_tag === 'string' ? req.query.major_tag : undefined;
    const data = await GistService.trending(20, viewerAvitag, { campus_tag: campus_tag ?? null, major_tag: major_tag ?? null });
    // Populate profile for each gist
    await Promise.all(data.map(async (g: any) => {
      let profile = await ProfileUtils.findByAvitag(g.avitag);
      if (profile && profile.profile_type) {
        try {
          let fullProfile = null;
          switch (profile.profile_type) {
            case 'STUDENT':
              fullProfile = await (await import('../profile/students/repo')).findByAvitag(g.avitag);
              break;
            case 'KREATOR':
              fullProfile = await (await import('../profile/kreators/repo')).findByAvitag(g.avitag);
              break;
            case 'KOMPANY':
              fullProfile = await (await import('../profile/kompanies/repo')).findByAvitag(g.avitag);
              break;
            case 'SCHOOL':
              fullProfile = await (await import('../profile/schools/repo')).findByAvitag(g.avitag);
              break;
            case 'IDIOT':
              fullProfile = await (await import('../profile/idiots/repo')).findByAvitag(g.avitag);
              break;
            default:
              fullProfile = profile;
          }
          g.profile = fullProfile || profile;
        } catch {
          g.profile = profile;
        }
      } else {
        g.profile = profile;
      }
    }));
    const viewer = req.user?.avitag ?? null;
    try {
      await Promise.all(data.map((g: any) => GistService.incrementView(g.gist_id, viewer)));
      WSGateway.broadcast('gist:viewed_batch', { gist_ids: data.map((g: any) => g.gist_id), by: viewer });
    } catch {}
    return res.json({ success: true, data });
  },

  search: async (req: Request, res: Response) => {
    const q = String(req.query.query || "").trim();
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const viewerAvitag = req.user?.avitag;
    const campus_tag = typeof req.query.campus_tag === 'string' ? req.query.campus_tag : undefined;
    const major_tag = typeof req.query.major_tag === 'string' ? req.query.major_tag : undefined;
    const data = q ? await GistService.search(q, limit, offset, viewerAvitag, { campus_tag: campus_tag ?? null, major_tag: major_tag ?? null }) : [];
    const viewer = req.user?.avitag ?? null;
    try {
      await Promise.all(data.map((g: any) => GistService.incrementView(g.gist_id, viewer)));
      WSGateway.broadcast('gist:viewed_batch', { gist_ids: data.map((g: any) => g.gist_id), by: viewer });
    } catch {}
    return res.json({ success: true, data });
  },

  report: async (req: Request, res: Response) => {
    if (!req.user?.avitag)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.gist_id;
    const { reason } = req.body || {};
    const gist = await GistService.findById(id);
    if (!gist)
      return res
        .status(404)
        .json({ success: false, message: "Gist not found" });
    if (gist.avitag === req.user.avitag)
      return res
        .status(400)
        .json({
          success: false,
          message: "Owners cannot report their own gist",
        });
    await GistService.report(id, req.user.avitag, reason ?? null);
    return res.json({ success: true, message: "Reported" });
  },

  view: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    const avitag = req.user?.avitag ?? null;
    await GistService.incrementView(id, avitag);
    return res.json({ success: true });
  },
};
