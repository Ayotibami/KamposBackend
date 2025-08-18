import type { Request, Response } from "express";
import { ReactionService } from "./reaction.service";
import type { ReactionEntityType } from "./reaction.interface";

export class ReactionController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await ReactionService.createReaction(avitag, req.body);
    return res.status(result.status || 201).json(result);
  }

  static async getByEntity(req: Request, res: Response) {
    const { entityType, entityId } = req.params as {
      entityType: ReactionEntityType;
      entityId: string;
    };
    const result = await ReactionService.getReactionsByEntity(
      entityType,
      entityId
    );
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { reactionId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await ReactionService.deleteReaction(
      reactionId || "",
      avitag
    );
    return res.status(result.status || 200).json(result);
  }
}
