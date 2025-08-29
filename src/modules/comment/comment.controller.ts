import type { Request, Response } from "express";
import { CommentService } from "./comment.service";

export class CommentController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await CommentService.createComment(avitag, req.body);
    return res.status(result.status || 201).json(result);
  }

  static async listAll(_req: Request, res: Response) {
    const result = await CommentService.getAllComments();
    return res.status(result.status || 200).json(result);
  }

  static async getById(req: Request, res: Response) {
    const { commentId } = req.params as { commentId: string };
    const result = await CommentService.getCommentById(commentId);
    return res.status(result.status || 200).json(result);
  }

  static async getByGistId(req: Request, res: Response) {
    const { gistId } = req.params;
    const result = await CommentService.getCommentsByGistId(gistId || "");
    return res.status(result.status || 200).json(result);
  }

  static async getByUser(req: Request, res: Response) {
    const { aviTag } = req.params as { aviTag: string };
    const result = await CommentService.getCommentsByUser(aviTag);
    return res.status(result.status || 200).json(result);
  }

  static async update(req: Request, res: Response) {
    const { commentId } = req.params as { commentId: string };
    const avitag = (req as any).user?.avitag;
    const result = await CommentService.updateComment(commentId, avitag, req.body);
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { commentId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await CommentService.deleteComment(commentId || "", avitag);
    return res.status(result.status || 200).json(result);
  }
}
