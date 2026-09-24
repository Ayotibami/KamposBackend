import type { Request, Response } from "express";
import * as repo from "./spot-comment.repo";
import { isAdminRole } from "../../middleware/idiot";

export const SpotCommentController = {
  create: async (req: Request, res: Response) => {
    const { spot_id, text } = req.body || {};
    const avitag = req.user?.avitag ?? null;
    if (!avitag) {
      return res.status(400).json({
        success: false,
        message: "Active profile (avitag) is required. Switch profile and retry.",
      });
    }
    const created = await repo.create({ spot_id, avitag, text });
    return res.status(201).json({ success: true, data: created });
  },

  listBySpot: async (req: Request, res: Response) => {
    const spot_id = req.params.spot_id;
    const limit = Number(req.query.limit ?? 20);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const data = await repo.listBySpot(spot_id, limit, cursor, req.user?.avitag);
    return res.json({ success: true, data });
  },

  remove: async (req: Request, res: Response) => {
    const role = req.user?.role;
    if (isAdminRole(role)) {
      const ok = await repo.removeAsAdmin(req.params.comment_id);
      if (!ok) return res.status(404).json({ success: false, message: "Comment not found" });
      return res.json({ success: true, message: "Deleted" });
    }
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: "Unauthorized" });
    const ok = await repo.remove(req.params.comment_id, req.user.avitag);
    if (!ok) return res.status(404).json({ success: false, message: "Comment not found or forbidden" });
    return res.json({ success: true, message: "Deleted" });
  },
};
