import type { Request, Response } from "express";
import * as SpotRepo from "./spot.repo";
import { signUpload, deleteByPublicIdWithType } from "../../services/media/cloudinary";
import { env } from "../../config/env";
import { isAdminRole } from "../../middleware/idiot";
import { safeAudit } from "../audit/audit.util";
import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_BYTES, CAPTION_MAX_LEN } from "./spot.constants";

/** Shared gate for the two draft-mutating endpoints (signature, finalize):
 * the caller must be logged in, must own this exact draft, and it must
 * still genuinely be a draft (not already finalized, not someone else's).
 * Responds and returns null when any of that fails, so call sites can just
 * `if (!spot) return;` — same shape as media.controller.ts's own
 * assertCanEditGist. */
async function assertOwnsDraft(req: Request, res: Response, spot_id: string): Promise<SpotRepo.SpotRow | null> {
  if (!req.user?.avitag) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  const spot = await SpotRepo.findById(spot_id);
  if (!spot) {
    res.status(404).json({ success: false, message: "Spot not found" });
    return null;
  }
  if (spot.avitag !== req.user.avitag) {
    res.status(403).json({ success: false, message: "You can only manage your own spot" });
    return null;
  }
  if (spot.status !== "DRAFT") {
    res.status(400).json({ success: false, message: "This spot has already been posted" });
    return null;
  }
  return spot;
}

export const SpotController = {
  // Step 1 of the upload flow: reserves a spot_id before any video bytes
  // exist anywhere — see spot.repo.ts's finalize() doc for why this has to
  // come first (Cloudinary's folder needs an id to upload into).
  draft: async (req: Request, res: Response) => {
    if (!req.user?.avitag) {
      return res.status(400).json({
        success: false,
        message: "Active profile (avitag) is required. Switch profile and retry.",
      });
    }
    const profile_id = `${req.user.avitag}:${req.user.account_id}`;
    const spot = await SpotRepo.createDraft(req.user.avitag, req.user.account_id, profile_id, req.user.profileType || "");
    return res.status(201).json({ success: true, data: spot });
  },

  // Step 2: hands the client a short-lived signed params set so it can
  // upload the video straight to Cloudinary, bypassing this server for the
  // actual file bytes — same trick media.controller.ts's own `signature`
  // uses for gist media.
  signature: async (req: Request, res: Response) => {
    const spot_id = req.params.spot_id;
    const spot = await assertOwnsDraft(req, res, spot_id);
    if (!spot) return;
    const folder = `kampos/spots/${spot_id}`;
    const { signature, timestamp } = signUpload({ folder });
    return res.json({
      success: true,
      data: {
        signature,
        timestamp,
        api_key: env.CLOUDINARY_API_KEY,
        cloud_name: env.CLOUDINARY_NAME,
        folder,
        upload_url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_NAME}/auto/upload`,
      },
    });
  },

  // Step 3: the client already uploaded directly to Cloudinary by this
  // point — this records the result and publishes the spot, after
  // re-validating against what CLOUDINARY itself reported (never the
  // client's own claims), same trust boundary media.controller.ts's own
  // `finalize` uses.
  finalize: async (req: Request, res: Response) => {
    const spot_id = req.params.spot_id;
    const spot = await assertOwnsDraft(req, res, spot_id);
    if (!spot) return;
    const avitag = req.user!.avitag!;

    const { media_url, public_id, resource_type, bytes, duration, width, height, caption, trim_start, trim_end } = req.body || {};

    if (typeof media_url !== "string" || typeof public_id !== "string" || !public_id) {
      return res.status(400).json({ success: false, message: "media_url and public_id are required" });
    }
    if (resource_type !== "video") {
      return res.status(400).json({ success: false, message: "Spot only accepts video" });
    }
    // Only ever trust a URL actually hosted on this account's own
    // Cloudinary cloud — same reasoning media.controller.ts's own
    // `finalize` gives for the identical check.
    const expectedHost = `res.cloudinary.com/${env.CLOUDINARY_NAME}/`;
    if (!media_url.startsWith("https://") || !media_url.includes(expectedHost)) {
      return res.status(400).json({ success: false, message: "media_url must be a Kampos-hosted Cloudinary URL" });
    }

    const sizeBytes = typeof bytes === "number" ? bytes : 0;
    const durationSeconds = typeof duration === "number" ? duration : 0;
    if (sizeBytes > MAX_VIDEO_BYTES || durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      try {
        await deleteByPublicIdWithType(public_id, "video");
      } catch {
        /* best-effort cleanup — the draft row staying un-finalized is what actually matters */
      }
      return res.status(413).json({
        success: false,
        message: `Video too large or too long (max ${MAX_VIDEO_BYTES / 1024 / 1024}MB, ${MAX_VIDEO_DURATION_SECONDS}s)`,
      });
    }

    // Trim — optional, and never a re-upload/re-encode: Cloudinary applies
    // so_/eo_ (start/end offset) as a lazy, on-the-fly delivery transform,
    // generated on first request and CDN-cached after, same as the so_0
    // poster-frame trick two lines below — not an eager transform computed
    // at upload time (this codebase already hit that exact processing-delay
    // pain once, see the thumbnail_url comment's history). The original,
    // untrimmed bytes stay on Cloudinary under `public_id` regardless —
    // trimming again later would just mean a different so_/eo_ pair.
    let trimStartSeconds: number | null = null;
    let trimEndSeconds: number | null = null;
    if (typeof trim_start === "number" && typeof trim_end === "number") {
      const tooLong = durationSeconds > 0 && trim_end > durationSeconds + 1; // +1s float/rounding slack
      if (trim_start < 0 || trim_end <= trim_start || tooLong) {
        return res.status(400).json({ success: false, message: "Invalid trim range" });
      }
      trimStartSeconds = trim_start;
      trimEndSeconds = trim_end;
    }
    const effectiveDurationSeconds = trimStartSeconds !== null && trimEndSeconds !== null
      ? trimEndSeconds - trimStartSeconds
      : durationSeconds;

    const safeCaption = typeof caption === "string" && caption.trim() ? caption.trim().slice(0, CAPTION_MAX_LEN) : null;
    // Lazy delivery-URL transform, not rendered eagerly — same `so_0` poster-
    // frame trick media.controller.ts's own `finalize` uses for gist video.
    // Poster now taken from the trimmed start (not always frame 0) once a
    // trim is applied — the original frame 0 may no longer be part of the
    // clip anyone actually sees.
    const posterOffset = trimStartSeconds ?? 0;
    const thumbnail_url = `https://res.cloudinary.com/${env.CLOUDINARY_NAME}/video/upload/so_${posterOffset},w_400,c_scale,f_jpg/${public_id}.jpg`;
    const uploadMarker = "/upload/";
    const uploadIdx = media_url.indexOf(uploadMarker);
    const deliveredMediaUrl = trimStartSeconds !== null && trimEndSeconds !== null && uploadIdx !== -1
      ? `${media_url.slice(0, uploadIdx + uploadMarker.length)}so_${trimStartSeconds},eo_${trimEndSeconds}/${media_url.slice(uploadIdx + uploadMarker.length)}`
      : media_url;

    const finalized = await SpotRepo.finalize(spot_id, avitag, {
      media_url: deliveredMediaUrl,
      thumbnail_url,
      public_id,
      duration_seconds: effectiveDurationSeconds || null,
      width: typeof width === "number" ? width : null,
      height: typeof height === "number" ? height : null,
      caption: safeCaption,
    });
    if (!finalized) {
      return res.status(409).json({ success: false, message: "This spot is no longer a draft" });
    }

    const full = await SpotRepo.findWithCounts(spot_id, avitag);
    return res.status(201).json({ success: true, data: full ?? finalized });
  },

  // The global feed — unconditionally unscoped, recency-dominant with a
  // light engagement boost (see spot.repo.ts's listRecent doc).
  list: async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const viewerAvitag = req.user?.avitag;
    const data = await SpotRepo.listRecent(limit, cursor, viewerAvitag);
    return res.json({ success: true, data });
  },

  // A profile page's own Spot grid — same "count only on the first page"
  // trick gist.controller.ts's own byUser uses (a repeat COUNT(*) on every
  // later page would just be thrown away).
  listByUser: async (req: Request, res: Response) => {
    const avitag = req.params.avitag;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const viewerAvitag = req.user?.avitag;
    const [data, total] = await Promise.all([
      SpotRepo.listByUser(avitag, limit, cursor, viewerAvitag),
      cursor ? Promise.resolve(undefined) : SpotRepo.countByUser(avitag, viewerAvitag),
    ]);
    return res.json({ success: true, data, ...(total !== undefined ? { total } : {}) });
  },

  get: async (req: Request, res: Response) => {
    const id = req.params.spot_id;
    const viewerAvitag = req.user?.avitag;
    const spot = await SpotRepo.findWithCounts(id, viewerAvitag);
    if (spot) return res.json({ success: true, data: spot });

    // Not ACTIVE (or author's profile isn't live) — fall back to the
    // owner/admin bypass, same "any status, ownership checked here" shape
    // gist.controller.ts's own `get` uses.
    const full = await SpotRepo.findWithCountsAnyStatus(id, viewerAvitag);
    if (!full) return res.status(404).json({ success: false, message: "Spot not found" });
    const isOwner = req.user?.avitag && req.user.avitag === full.avitag;
    const isAdmin = isAdminRole(req.user?.role);
    if (isOwner || isAdmin) return res.json({ success: true, data: full });
    return res.status(404).json({ success: false, message: "Spot not found" });
  },

  remove: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.spot_id;
    if (isAdminRole(req.user.role)) {
      // Admin takedown lands as REJECTED, not REMOVED — distinguishes a
      // moderator's action from the poster's own self-delete in the audit
      // trail (see spot.repo.ts's remove() doc).
      const ok = await SpotRepo.rejectAsAdmin(id);
      if (!ok) return res.status(404).json({ success: false, message: "Spot not found" });
      const { reason } = req.body || {};
      await safeAudit({
        action: "SPOT_REJECT",
        target_type: "SPOT",
        target_id: id,
        idiot_avitag: req.user.avitag ?? req.user.account_id,
        reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null,
      });
      return res.json({ success: true, message: "Removed" });
    }
    const ok = await SpotRepo.remove(id, req.user.avitag);
    if (!ok) return res.status(404).json({ success: false, message: "Spot not found or forbidden" });
    return res.json({ success: true, message: "Removed" });
  },

  report: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.spot_id;
    const { reason } = req.body || {};
    const spot = await SpotRepo.findById(id);
    if (!spot) return res.status(404).json({ success: false, message: "Spot not found" });
    if (spot.avitag === req.user.avitag) {
      return res.status(400).json({ success: false, message: "You cannot report your own spot" });
    }
    const safeReason = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null;
    const isNew = await SpotRepo.report(id, req.user.avitag, safeReason);
    return res.json({
      success: true,
      message: isNew ? "Reported" : "You already reported this",
      data: { already_reported: !isNew },
    });
  },

  // Fired once per real playback (see spot.repo.ts's incrementView doc) —
  // not batched across a feed page the way gist.controller.ts's `list`
  // does, deliberately: "fetched" and "actually played" aren't the same
  // event for a snap-scroll video feed the way they effectively are for a
  // text feed.
  view: async (req: Request, res: Response) => {
    const id = req.params.spot_id;
    const avitag = req.user?.avitag ?? null;
    await SpotRepo.incrementView(id, avitag);
    return res.json({ success: true });
  },

  // Fired once a share actually completes (native share sheet resolves,
  // copy-link clicked) — not just when the share sheet opens.
  share: async (req: Request, res: Response) => {
    const id = req.params.spot_id;
    const avitag = req.user?.avitag ?? null;
    const platformRaw = req.body?.platform;
    const platform = typeof platformRaw === "string" && platformRaw.trim() ? platformRaw.trim().slice(0, 40) : null;
    await SpotRepo.incrementShare(id, avitag, platform);
    return res.json({ success: true });
  },
};
