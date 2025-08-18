import type { Request, Response } from "express";
import { CommentService } from "./comment.service";

export class CommentController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await CommentService.createComment(avitag, req.body);
    return res.status(result.status || 201).json(result);
  }

  static async getByGistId(req: Request, res: Response) {
    const { gistId } = req.params;
    const result = await CommentService.getCommentsByGistId(gistId || "");
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { commentId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await CommentService.deleteComment(commentId || "", avitag);
    return res.status(result.status || 200).json(result);
  }
}
