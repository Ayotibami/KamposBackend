import type { Request, Response } from "express";
import { GistService } from "./gist.service";

export class GistController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await GistService.createGist(avitag, req.body);
    return res.status(result.status || 201).json(result);
  }

  static async getAll(req: Request, res: Response) {
    const { page = 1, limit = 10 } = req.query;
    const result = await GistService.getAllGists(Number(page), Number(limit));
    return res.status(result.status || 200).json(result);
  }

  static async getById(req: Request, res: Response) {
    const { gistId } = req.params;
    const result = await GistService.getGistById(gistId || "");
    return res.status(result.status || 200).json(result);
  }

  static async update(req: Request, res: Response) {
    const { gistId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await GistService.updateGist(gistId || "", avitag, req.body);
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { gistId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await GistService.deleteGist(gistId || "", avitag);
    return res.status(result.status || 200).json(result);
  }

  static async getByAvitag(req: Request, res: Response) {
    const { avi_tag } = req.params;
    const result = await GistService.getGistsByAvitag(avi_tag || "");
    return res.status(result.status || 200).json(result);
  }

  static async getTrending(req: Request, res: Response) {
    const { page = 1, limit = 10, timeRange = "7 days" } = req.query;
    const result = await GistService.getTrendingGists(
      Number(page),
      Number(limit),
      String(timeRange)
    );
    return res.status(result.status || 200).json(result);
  }

  static async search(req: Request, res: Response) {
    const { query, page = 1, limit = 10 } = req.query;
    const result = await GistService.searchGists(
      String(query),
      Number(page),
      Number(limit)
    );
    return res.status(result.status || 200).json(result);
  }
}
