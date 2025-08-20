import type { Request, Response, NextFunction } from "express";
import { gistService } from "./gist.service";
import { ApiError } from "../../utils/responseHandler";

export class GistController {
  static async createGist(req: Request, res: Response, next: NextFunction) {
    try {
      const avitag = req.user!.avitag;
      const gistData = req.body;
      const result = await gistService.createGist(avitag, gistData);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getAllGists(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const isAdmin = req.user?.profile_type === "ADMIN";
      const result = await gistService.getAllGists(page, limit, isAdmin);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getGistById(req: Request, res: Response, next: NextFunction) {
    try {
      const { gist_id } = req.params;
      const isAdmin = req.user?.profile_type === "ADMIN";
      const result = await gistService.getGistById(gist_id || "", isAdmin);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async updateGist(req: Request, res: Response, next: NextFunction) {
    try {
      const { gist_id } = req.params;
      const avitag = req.user!.avitag;
      const updates = req.body;
      const result = await gistService.updateGist(gist_id || "", avitag, updates);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async deleteGist(req: Request, res: Response, next: NextFunction) {
    try {
      const { gist_id } = req.params;
      const avitag = req.user!.avitag;
      const result = await gistService.deleteGist(gist_id || "", avitag);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getGistsByAvitag(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { avitag } = req.params;
      const result = await gistService.getGistsByAvitag(avitag || "");
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getTrendingGists(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const timeRange = (req.query.timeRange as string) || "24h";
      const result = await gistService.getTrendingGists(page, limit, timeRange);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async searchGists(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query.query as string;
      if (!query) throw ApiError.badRequest("Search query is required");
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await gistService.searchGists(query, page, limit);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async approveGist(req: Request, res: Response, next: NextFunction) {
    try {
      const { gist_id } = req.params;
      const { approved } = req.body;
      const avitag = req.user!.avitag;
      const result = await gistService.approveGist(avitag, gist_id || "", approved);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getReportedGists(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const avitag = req.user!.avitag;
      const result = await gistService.getReportedGists(avitag);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const gistController = GistController;
