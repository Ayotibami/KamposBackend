import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { HotService } from "./hot.service";
import { signUpload, deleteByPublicIdWithType } from "../../services/media/cloudinary";
import { env } from "../../config/env";
import { WSGateway } from "../../ws/gateway";
import { safeAudit } from "../audit/audit.util";
import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_BYTES, MAX_IMAGE_BYTES, TEXT_MAX_LEN } from "./hot.constants";
import type { HotMediaKind } from "./hot.repo";

// Exact same 8 hex values as the frontend's GIST_CARD_PALETTE
// (kampos-web/src/lib/brand.ts) — the composer sends one of these
// verbatim as `color_key`, never a name/index, so this just needs to
// reject anything that isn't actually one of the 8 real swatches.
const GIST_CARD_PALETTE_KEYS = [
  "#572929", // red
  "#574029", // orange
  "#575329", // yellow
  "#295730", // green
  "#29574b", // teal
  "#293857", // blue
  "#442957", // purple
  "#572940", // pink
];

export const HotController = {
  // Step 1 of the upload flow, PHOTO/VIDEO only — mints the eventual
  // hot_post_id up front (nothing written to Postgres yet) purely so
  // Cloudinary's folder path has a stable id to upload into, then hands
  // back a short-lived signed params set so the browser can upload
  // straight to Cloudinary, bypassing this server for the actual file
  // bytes. Same trick media.controller.ts/spot.controller.ts's own
  // `signature` endpoints use. No draft row, unlike Spot's own
  // draft-then-signature dance — see hot.repo.ts's create() doc comment
  // for why Hot doesn't need that extra step.
  uploadSignature: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { media_kind } = req.body || {};
    if (media_kind !== "PHOTO" && media_kind !== "VIDEO") {
      return res.status(400).json({ success: false, message: "media_kind must be PHOTO or VIDEO" });
    }
    const hot_post_id = randomUUID();
    const folder = `kampos/hot/${hot_post_id}`;
    const { signature, timestamp } = signUpload({ folder });
    return res.json({
      success: true,
      data: {
        hot_post_id,
        signature,
        timestamp,
        api_key: env.CLOUDINARY_API_KEY,
        cloud_name: env.CLOUDINARY_NAME,
        folder,
        upload_url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_NAME}/auto/upload`,
      },
    });
  },

  // The one real creation call, for all three kinds. For PHOTO/VIDEO, the
  // client already uploaded straight to Cloudinary by this point — this
  // re-validates against what CLOUDINARY itself reported (never the
  // client's own claims), same trust boundary every other upload flow in
  // this codebase uses.
  create: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const avitag = req.user.avitag;
    const { media_kind, text, color_key, hot_post_id, media_url, public_id, resource_type, bytes, duration, width, height } =
      req.body || {};

    if (media_kind !== "TEXT" && media_kind !== "PHOTO" && media_kind !== "VIDEO") {
      return res.status(400).json({ success: false, message: "media_kind must be TEXT, PHOTO, or VIDEO" });
    }

    const safeText =
      typeof text === "string" && text.trim() ? text.trim().slice(0, TEXT_MAX_LEN) : null;

    if (media_kind === "TEXT") {
      if (!safeText) {
        return res.status(400).json({ success: false, message: "Text is required for a text post" });
      }
      const safeColor =
        typeof color_key === "string" && GIST_CARD_PALETTE_KEYS.includes(color_key) ? color_key : GIST_CARD_PALETTE_KEYS[0];
      const saved = await HotService.create({
        avitag,
        media_kind: "TEXT" as HotMediaKind,
        text: safeText,
        media_url: null,
        public_id: null,
        thumbnail_url: null,
        color_key: safeColor,
        duration_ms: null,
      });
      try {
        WSGateway.broadcast("hot_post:created", { hot_post: saved });
      } catch {
        /* realtime push is a nicety, never a reason to fail the post itself */
      }
      return res.status(201).json({ success: true, data: saved });
    }

    // PHOTO or VIDEO from here on.
    if (typeof hot_post_id !== "string" || !hot_post_id) {
      return res.status(400).json({ success: false, message: "hot_post_id (from /upload-signature) is required" });
    }
    if (typeof media_url !== "string" || typeof public_id !== "string" || !public_id) {
      return res.status(400).json({ success: false, message: "media_url and public_id are required" });
    }
    const expectedResourceType = media_kind === "VIDEO" ? "video" : "image";
    if (resource_type !== expectedResourceType) {
      return res.status(400).json({ success: false, message: `A ${media_kind} post needs a ${expectedResourceType} upload` });
    }
    // Only ever trust a URL actually hosted on this account's own Cloudinary
    // cloud — same check every other finalize/create endpoint in this
    // codebase makes, never the client's own claimed URL.
    const expectedHost = `res.cloudinary.com/${env.CLOUDINARY_NAME}/`;
    if (!media_url.startsWith("https://") || !media_url.includes(expectedHost)) {
      return res.status(400).json({ success: false, message: "media_url must be a Kampos-hosted Cloudinary URL" });
    }

    const sizeBytes = typeof bytes === "number" ? bytes : 0;
    const durationSeconds = typeof duration === "number" ? duration : 0;
    const tooBig =
      media_kind === "VIDEO"
        ? sizeBytes > MAX_VIDEO_BYTES || durationSeconds > MAX_VIDEO_DURATION_SECONDS
        : sizeBytes > MAX_IMAGE_BYTES;
    if (tooBig) {
      try {
        await deleteByPublicIdWithType(public_id, expectedResourceType);
      } catch {
        /* best-effort cleanup — rejecting the request is what actually matters */
      }
      const message =
        media_kind === "VIDEO"
          ? `Video too large or too long (max ${MAX_VIDEO_BYTES / 1024 / 1024}MB, ${MAX_VIDEO_DURATION_SECONDS}s)`
          : `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`;
      return res.status(413).json({ success: false, message });
    }

    // Lazy delivery-URL transform for the video poster frame, never
    // rendered eagerly — same reasoning media.controller.ts's own
    // `finalize` gives (an eager transform blocks the upload response for
    // real transcode time, which broke that flow's progress indicator).
    const thumbnail_url =
      media_kind === "VIDEO"
        ? `https://res.cloudinary.com/${env.CLOUDINARY_NAME}/video/upload/so_0,w_400,c_scale,f_jpg/${public_id}.jpg`
        : null;

    const saved = await HotService.create({
      hot_post_id,
      avitag,
      media_kind: media_kind as HotMediaKind,
      text: safeText,
      media_url,
      public_id,
      thumbnail_url,
      color_key: null,
      duration_ms: media_kind === "VIDEO" && durationSeconds > 0 ? Math.round(durationSeconds * 1000) : null,
    });
    try {
      WSGateway.broadcast("hot_post:created", { hot_post: saved });
    } catch {
      /* realtime push is a nicety, never a reason to fail the post itself */
    }
    return res.status(201).json({ success: true, data: saved });
  },

  // Your own still-visible posts.
  mine: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const data = await HotService.listMine(req.user.avitag);
    return res.json({ success: true, data });
  },

  // Everyone else's, grouped by author and ranked into the 6 tiers — see
  // hot.service.ts's listFeed doc comment for the full ranking rules.
  feed: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const data = await HotService.listFeed(req.user.avitag, req.user.campus_tag ?? null, req.user.major_tag ?? null);
    return res.json({ success: true, data });
  },

  // Batched (see hot.repo.ts's markSeenBatch doc) — fired once as you close
  // the viewer or move to a different person's stack, carrying every post
  // id you actually landed on this session, rather than one call per post.
  markSeen: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { hot_post_ids } = req.body || {};
    if (!Array.isArray(hot_post_ids) || hot_post_ids.some((id) => typeof id !== "string")) {
      return res.status(400).json({ success: false, message: "hot_post_ids must be an array of strings" });
    }
    // Capped well above any realistic single session's worth of posts —
    // purely a guardrail against a malformed/abusive payload, not a real
    // limit anyone should ever hit in normal use.
    const ids = hot_post_ids.slice(0, 200);
    await HotService.markSeenBatch(req.user.avitag, ids);
    return res.json({ success: true });
  },

  // Self-delete only — no admin/moderation path exists for Hot posts (see
  // hot.repo.ts's remove() doc comment). A real hard delete, matching
  // gist.controller.ts's owner branch: gone right away, not just once the
  // 24h window runs out — exactly what the app's own delete-confirm dialog
  // already promises the user.
  remove: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.hot_post_id;
    const deleted = await HotService.deleteByOwner(id, req.user.avitag);
    if (!deleted) return res.status(404).json({ success: false, message: "Post not found or forbidden" });
    if (deleted.public_id) {
      try {
        await deleteByPublicIdWithType(deleted.public_id, deleted.media_kind === "VIDEO" ? "video" : "image");
      } catch {
        /* best-effort cleanup — the DB row is already gone, which is what actually matters */
      }
    }
    try {
      WSGateway.broadcast("hot_post:deleted", { hot_post_id: id, avitag: req.user.avitag });
    } catch {
      /* realtime push is a nicety, never a reason to fail the delete itself */
    }
    await safeAudit({
      action: "HOT_POST_SELF_DELETE",
      target_type: "HOT_POST",
      target_id: id,
      idiot_avitag: req.user.avitag,
    });
    return res.json({ success: true, message: "Deleted" });
  },
};
