import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as reactionRepo from "./reaction.model";
import * as gistRepo from "../gist/gist.model";
import * as commentRepo from "../comment/comment.model";
import * as profileRepo from "../profile/profile.model";
import * as notificationService from "../notification/notification.service";
import type { IReaction, ReactionEntityType } from "./reaction.interface";

export class ReactionService {
  static async createReaction(
    avitag: string,
    reactionData: Partial<IReaction>
  ) {
    const { entityType, entityId, type } = reactionData;
    let targetAvitag: string | null = null;

    if (entityType === "GIST") {
      const gist = await gistRepo.findGistById(entityId!);
      if (!gist) throw ApiError.notFound("Gist not found");
      targetAvitag = gist.avitag;
    } else if (entityType === "COMMENT") {
      const comment = await commentRepo.findCommentById(entityId!);
      if (!comment) throw ApiError.notFound("Comment not found");
      targetAvitag = comment.avitag;
    }

    const existingReaction = await reactionRepo.findReactionsByEntity(
      entityType!,
      entityId!
    );
    if (existingReaction.some((r) => r.avitag === avitag && r.type === type)) {
      throw ApiError.badRequest("Reaction already exists");
    }

    const reaction = await reactionRepo.createReaction({
      ...reactionData,
      avitag,
    });

    if (targetAvitag && targetAvitag !== avitag) {
      const profile = await profileRepo.findProfileByAvitag(avitag);
      await notificationService.NotificationService.createNotification({
        avitag: targetAvitag,
        type: "GIST_LIKE",
        message: `${
          profile?.displayName
        } reacted ${type} to your ${entityType?.toLowerCase()}!`,
        referenceId: reaction.reactionId,
      });
    }

    return ApiSuccess.created("Reaction created", reaction);
  }

  static async getReactionsByEntity(
    entityType: ReactionEntityType,
    entityId: string
  ) {
    if (entityType === "GIST") {
      const gist = await gistRepo.findGistById(entityId);
      if (!gist) throw ApiError.notFound("Gist not found");
    } else if (entityType === "COMMENT") {
      const comment = await commentRepo.findCommentById(entityId);
      if (!comment) throw ApiError.notFound("Comment not found");
    }
    const reactions = await reactionRepo.findReactionsByEntity(
      entityType,
      entityId
    );
    return ApiSuccess.ok("Reactions fetched", reactions);
  }

  static async deleteReaction(reactionId: string, avitag: string) {
    const reaction = await reactionRepo.findReactionById(reactionId);
    if (!reaction) throw ApiError.notFound("Reaction not found");
    if (reaction.avitag !== avitag)
      throw ApiError.forbidden("Not authorized to delete this reaction");
    await reactionRepo.deleteReactionById(reactionId);
    return ApiSuccess.ok("Reaction deleted");
  }
}
