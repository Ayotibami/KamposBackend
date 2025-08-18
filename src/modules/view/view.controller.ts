import type { Request, Response } from "express";
import { ViewService } from "./view.service";

export class ViewController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const { gistId } = req.body;
    const result = await ViewService.createView(avitag, gistId);
    return res.status(result.status || 201).json(result);
  }

  static async getByGistId(req: Request, res: Response) {
    const { gistId } = req.params;
    const result = await ViewService.getViewsByGistId(gistId || "");
    return res.status(result.status || 200).json(result);
  }

  static async getCountByGistId(req: Request, res: Response) {
    const { gistId } = req.params;
    const result = await ViewService.getViewCountByGistId(gistId || "");
    return res.status(result.status || 200).json(result);
  }
}
