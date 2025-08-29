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

  static async getByUser(req: Request, res: Response) {
    const { aviTag } = req.params as { aviTag: string };
    const result = await ReactionService.getReactionsByUser(aviTag);
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

  static async deleteByEntityAndUser(req: Request, res: Response) {
    const { entityType, entityId, aviTag } = req.params as {
      entityType: ReactionEntityType;
      entityId: string;
      aviTag: string;
    };
    const requester = (req as any).user?.avitag as string;
    const result = await ReactionService.deleteByEntityAndUser(
      entityType,
      entityId,
      aviTag,
      requester
    );
    return res.status(result.status || 200).json(result);
  }
}
