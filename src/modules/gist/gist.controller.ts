import type { Request, Response } from "express";
import { GistService } from './gist.service';
import { WSGateway } from '../../ws/gateway';
import { env } from '../../config/env';
import * as ProfileUtils from '../profile/utils';
import * as GistMediaRepo from './media.repo';
import { uploadBuffer } from '../../services/media/cloudinary';
import { GIST_COLOR_KEYS } from './gist.constants';
import logger from '../../utils/logger';

// Whitelisted rather than trusted as-is so `color_key` can never become a
// stored-XSS-style free text field via a crafted request — belt-and-braces
// alongside the schema-level z.enum in schemas/gist.ts, which already
// rejects anything outside this set before the request even reaches here.
const VALID_GIST_COLOR_KEYS = new Set<string>(GIST_COLOR_KEYS);

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
    const { gist_text, color_key } = req.body || {};
    const profile = await ProfileUtils.findByAvitag(req.user.avitag);
    const isVerified = !!profile?.is_verified;
    const maxLen = isVerified ? env.VERIFIED_GIST_MAX : env.UNVERIFIED_GIST_MAX;
    if (typeof gist_text !== 'string' || gist_text.length < 1) {
      return res.status(400).json({ success: false, message: 'gist_text is required' });
    }
    if (gist_text.length > maxLen) {
      return res.status(400).json({ success: false, message: `gist_text exceeds limit (${maxLen} chars for ${isVerified ? 'verified' : 'unverified'} profiles)` });
    }
    const safeColorKey = typeof color_key === 'string' && VALID_GIST_COLOR_KEYS.has(color_key) ? color_key : null;
    // Compose profile_id as avitag:account_id
    const profile_id = `${req.user.avitag}:${req.user.account_id}`;
    // Off the session token, not a fresh lookup — same reasoning as the
    // feed's own scoping (see JwtClaims' own docs). Both undefined only
    // for a token issued before this claim existed; one query covers both
    // in that case, not two, and only for that narrow transition window.
    let campusTagForGist = req.user.campus_tag;
    let majorTagForGist = req.user.major_tag;
    if (campusTagForGist === undefined && majorTagForGist === undefined) {
      const resolved = await ProfileUtils.getCampusMajor(req.user.avitag);
      campusTagForGist = resolved.campus_tag;
      majorTagForGist = resolved.major_tag;
    }
    const gist = await GistService.create(
      req.user.avitag,
      req.user.account_id,
      profile_id,
      req.user.profileType || '',
      gist_text,
      campusTagForGist ?? null,
      majorTagForGist ?? null,
      safeColorKey
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

        // Upload in sequence to preserve order_index. Each file gets its
        // own try/catch — previously one big try/catch wrapped the whole
        // loop, so a single failed upload (network blip, a transient
        // Cloudinary error) silently killed every file after it too, and
        // the failure was never reported anywhere: the request still came
        // back 201 with the gist's text, as if nothing was ever attached.
        let idx = 0;
        const failed: Array<{ name: string; reason: string }> = [];
        for (const f of inputs) {
          try {
            const isVideo = f.mimetype.startsWith('video/');
            const uploaded: any = await uploadBuffer(f.data, `kampos/gists/${gist.gist_id}`, isVideo);
            const media_type: GistMediaRepo.MediaType = uploaded?.resource_type === 'video' ? 'VIDEO' : 'IMAGE';
            const media_url: string = uploaded?.secure_url || uploaded?.url;
            const thumbnail_url: string | null = uploaded?.thumbnail_url || uploaded?.eager?.[0]?.secure_url || null;
            const public_id: string | null = uploaded?.public_id || null;
            const width: number | null = typeof uploaded?.width === "number" ? uploaded.width : null;
            const height: number | null = typeof uploaded?.height === "number" ? uploaded.height : null;
            const saved = await GistMediaRepo.addMedia({
              gist_id: gist.gist_id,
              media_type,
              media_url,
              thumbnail_url,
              width,
              height,
              order_index: idx,
              public_id,
            });
            idx += 1;
            try { WSGateway.broadcast('gist_media:created', { gist_id: gist.gist_id, media: saved }); } catch {}
          } catch (fileErr) {
            // The real reason (a raw Cloudinary SDK/network exception) is
            // logged here, not sent to the client — same reasoning as
            // errorHandler's GENERIC_MESSAGE: a client-facing field is not
            // the place for driver/SDK error text, even on an otherwise-
            // successful 201 response like this one.
            logger.error({ err: fileErr, gist_id: gist.gist_id, file: f.name }, 'Gist media upload failed');
            failed.push({ name: f.name, reason: "Couldn't upload this one — please try again." });
          }
        }
        if (failed.length) {
          (req as any)._mediaUploadFailures = failed;
        }
      }
    } catch (e) {
      // The file-parsing step above this loop (reading req.files) can still
      // throw outright — keep the gist itself successful either way, same
      // as before, just no longer able to silently eat per-file failures.
    }

    // Fetch the gist with media aggregated so client gets media inline
    const failures = (req as any)._mediaUploadFailures as Array<{ name: string; reason: string }> | undefined;
    try {
      const full = await GistService.findWithCountsAnyStatus?.(gist.gist_id as any, req.user?.avitag);
      if (full) return res.status(201).json({ success: true, data: full, media_failures: failures });
    } catch {}
    return res.status(201).json({ success: true, data: { ...gist, media: [] }, media_failures: failures });
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
              fullProfile = await (await import('../profile/students/repo.js')).findByAvitag(gistAny.avitag);
              break;
            case 'KREATOR':
              fullProfile = await (await import('../profile/kreators/repo.js')).findByAvitag(gistAny.avitag);
              break;
            case 'KOMPANY':
              fullProfile = await (await import('../profile/kompanies/repo.js')).findByAvitag(gistAny.avitag);
              break;
            case 'SCHOOL':
              fullProfile = await (await import('../profile/schools/repo.js')).findByAvitag(gistAny.avitag);
              break;
            case 'IDIOT':
              fullProfile = await (await import('../profile/idiots/repo.js')).findByAvitag(gistAny.avitag);
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
            fullProfile = await (await import('../profile/students/repo.js')).findByAvitag(full.avitag);
            break;
          case 'KREATOR':
            fullProfile = await (await import('../profile/kreators/repo.js')).findByAvitag(full.avitag);
            break;
          case 'KOMPANY':
            fullProfile = await (await import('../profile/kompanies/repo.js')).findByAvitag(full.avitag);
            break;
          case 'SCHOOL':
            fullProfile = await (await import('../profile/schools/repo.js')).findByAvitag(full.avitag);
            break;
          case 'IDIOT':
            fullProfile = await (await import('../profile/idiots/repo.js')).findByAvitag(full.avitag);
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

  // The shared-link experience: the exact gist someone shared, regardless
  // of moderation status (that's the deliberate exception — everything
  // else here still only shows APPROVED siblings), plus chronological
  // neighbors on each side to browse into. No ownership/admin check on
  // the target, unlike plain `get` above — this route is meant to work
  // for a stranger who just clicked a link, not just the poster.
  context: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    const before = Math.min(Math.max(Number(req.query.before ?? 15), 0), 30);
    const after = Math.min(Math.max(Number(req.query.after ?? 15), 0), 30);
    const result = await GistService.getContext(id, before, after, req.user?.avitag);
    if (!result) return res.status(404).json({ success: false, message: 'Gist not found' });

    const viewer = req.user?.avitag ?? null;
    await GistService.incrementView(id, viewer);
    try {
      WSGateway.broadcast('gist:viewed', { gist_id: id, by: viewer });
    } catch {}

    return res.json({ success: true, data: result });
  },

  list: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const viewerAvitag = req.user?.avitag;
    const major_tag = typeof req.query.major_tag === 'string' ? req.query.major_tag : undefined;

    // Gist = your own school's students + every non-student poster,
    // unconditionally. Amebo = no campus filtering at all. School = one
    // specific OTHER campus's students, requested via ?school=<tag> (the
    // trending-school pills), PLUS — same as Gist — every non-student
    // poster unconditionally; a KREATOR/KOMPANY/SCHOOL/IDIOT post shows on
    // every filter regardless, since campus filtering only ever applies to
    // students. The viewer's own campus for Gist mode is always derived
    // server-side from their session, never trusted from the client — a
    // spoofed campus_tag query param used to be able to filter the feed to
    // any school at all. Two cases fall back to Amebo's unfiltered behavior
    // even when 'gist' was requested: a guest (nothing to filter by) and a
    // logged-in non-student viewer (KREATOR/KOMPANY/SCHOOL/IDIOT — no
    // campus of their own either), so neither ends up with an emptier Gist
    // tab than a guest would get. Same graceful-degrade applies to 'school'
    // with a missing/empty ?school= — falls back to unfiltered rather than
    // an empty result.
    const feedModeRaw = req.query.feed_mode;
    const feedMode = feedModeRaw === 'gist' ? 'gist' : feedModeRaw === 'school' ? 'school' : 'amebo';
    let scopeMode: 'home' | 'school' | 'none' = 'none';
    let campusTag: string | null = null;
    if (feedMode === 'gist' && viewerAvitag) {
      // Read straight off the verified session — no database round trip on
      // the hottest read path in the app (this fires on every scroll, not
      // just every login). campus_tag lives in the token now (see
      // JwtClaims' own docs), refreshed automatically every ~15 minutes
      // along with the access token itself, so there's no staleness risk
      // and — just as importantly — nothing here to silently fail and
      // fall back to "show every school" the way a live lookup could.
      // req.user.campus_tag === undefined only for a token issued before
      // this claim existed at all — self-heals on this session's next
      // refresh (see the /auth/refresh handler's own one-time backfill);
      // falling back to the same live lookup here too, just for that
      // narrow transition window, rather than degrading to unfiltered.
      const tokenCampusTag = req.user?.campus_tag;
      const resolvedCampusTag =
        tokenCampusTag !== undefined
          ? tokenCampusTag
          : (await ProfileUtils.getCampusMajor(viewerAvitag)).campus_tag;
      if (resolvedCampusTag) {
        scopeMode = 'home';
        campusTag = resolvedCampusTag;
      }
    } else if (feedMode === 'school') {
      const school = typeof req.query.school === 'string' ? req.query.school.trim().toLowerCase() : '';
      if (school) {
        scopeMode = 'school';
        campusTag = school;
      }
    }

    const data = await GistService.listRecent(
      limit,
      cursor,
      viewerAvitag,
      { major_tag: major_tag ?? null },
      { mode: scopeMode, campusTag }
    );
    // Populate profile for each gist
    await Promise.all(data.map(async (g: any) => {
      let profile = await ProfileUtils.findByAvitag(g.avitag);
      if (profile && profile.profile_type) {
        try {
          let fullProfile = null;
          switch (profile.profile_type) {
            case 'STUDENT':
              fullProfile = await (await import('../profile/students/repo.js')).findByAvitag(g.avitag);
              break;
            case 'KREATOR':
              fullProfile = await (await import('../profile/kreators/repo.js')).findByAvitag(g.avitag);
              break;
            case 'KOMPANY':
              fullProfile = await (await import('../profile/kompanies/repo.js')).findByAvitag(g.avitag);
              break;
            case 'SCHOOL':
              fullProfile = await (await import('../profile/schools/repo.js')).findByAvitag(g.avitag);
              break;
            case 'IDIOT':
              fullProfile = await (await import('../profile/idiots/repo.js')).findByAvitag(g.avitag);
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
    // total is the same true count no matter which page is being fetched,
    // so it's only actually computed on the first page (no cursor) — the
    // frontend only needs to capture it once, and every later page would
    // otherwise pay for a redundant COUNT(*) it throws away.
    const [data, total] = await Promise.all([
      GistService.listByUser(avitag, limit, cursor, viewerAvitag),
      cursor ? Promise.resolve(undefined) : GistService.countByUser(avitag, viewerAvitag),
    ]);
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
    return res.json({ success: true, data, ...(total !== undefined ? { total } : {}) });
  },

  // The three (or fewer) school-filter pills beside Amebo — "which other
  // schools are trending right now", always excluding the viewer's own
  // campus (a school never gets suggested as a pill to its own students —
  // that's just Gist). A guest gets the plain top-N with nothing excluded.
  trendingSchools: async (req: Request, res: Response) => {
    // Off the session token — see JwtClaims' own docs. undefined only for
    // a token issued before this claim existed; falls back to the live
    // lookup just for that narrow transition window.
    const viewerAvitag = req.user?.avitag;
    const tokenCampusTag = req.user?.campus_tag;
    const viewerCampus =
      tokenCampusTag !== undefined
        ? tokenCampusTag
        : viewerAvitag
          ? (await ProfileUtils.getCampusMajor(viewerAvitag)).campus_tag
          : null;
    const data = await GistService.trendingSchools(viewerCampus);
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
              fullProfile = await (await import('../profile/students/repo.js')).findByAvitag(g.avitag);
              break;
            case 'KREATOR':
              fullProfile = await (await import('../profile/kreators/repo.js')).findByAvitag(g.avitag);
              break;
            case 'KOMPANY':
              fullProfile = await (await import('../profile/kompanies/repo.js')).findByAvitag(g.avitag);
              break;
            case 'SCHOOL':
              fullProfile = await (await import('../profile/schools/repo.js')).findByAvitag(g.avitag);
              break;
            case 'IDIOT':
              fullProfile = await (await import('../profile/idiots/repo.js')).findByAvitag(g.avitag);
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
    const isNew = await GistService.report(id, req.user.avitag, reason ?? null);
    return res.json({
      success: true,
      message: isNew ? "Reported" : "You already reported this",
      data: { already_reported: !isNew },
    });
  },

  view: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    const avitag = req.user?.avitag ?? null;
    await GistService.incrementView(id, avitag);
    try {
      const countsFull = await GistService.getCountsFull(id);
      WSGateway.broadcast('counts:updated', { gist_id: id, ...countsFull });
    } catch {}
    return res.json({ success: true });
  },

  // Fired by the frontend the moment a share actually goes out (a share
  // target link is opened, or the copy-link/native-share action completes)
  // — not just when the share sheet is opened, so this reflects real
  // shares, not attempts. `platform` is optional/free-form, purely logged
  // for later analytics.
  share: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    const avitag = req.user?.avitag ?? null;
    const platformRaw = req.body?.platform;
    const platform = typeof platformRaw === "string" && platformRaw.trim() ? platformRaw.trim().slice(0, 40) : null;
    await GistService.incrementShare(id, avitag, platform);
    try {
      const countsFull = await GistService.getCountsFull(id);
      WSGateway.broadcast('counts:updated', { gist_id: id, ...countsFull });
    } catch {}
    return res.json({ success: true });
  },
};
