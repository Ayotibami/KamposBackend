import type { Request, Response } from "express";
import { GistService } from "./gist.service";

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
    const gist = await GistService.create(req.user.avitag, gist_text);
    return res.status(201).json({ success: true, data: gist });
  },

  get: async (req: Request, res: Response) => {
    const id = req.params.gist_id;
    const gist = await GistService.findWithCounts(id);
    if (!gist)
      return res
        .status(404)
        .json({ success: false, message: "Gist not found" });
    return res.json({ success: true, data: gist });
  },

  list: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const data = await GistService.listRecent(limit, cursor);
    return res.json({ success: true, data });
  },

  update: async (req: Request, res: Response) => {
    if (!req.user?.avitag)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.gist_id;
    const { gist_text } = req.body || {};
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
    const data = await GistService.listByUser(avitag, limit, cursor);
    return res.json({ success: true, data });
  },

  trending: async (_req: Request, res: Response) => {
    const data = await GistService.trending(20);
    return res.json({ success: true, data });
  },

  search: async (req: Request, res: Response) => {
    const q = String(req.query.query || "").trim();
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = q ? await GistService.search(q, limit, offset) : [];
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
