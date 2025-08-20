import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as commentRepo from "./comment.model";
import * as gistRepo from "../gist/gist.model";
import * as profileRepo from "../profile/profile.model";
import type { IComment } from "./comment.interface";
import { NotificationService } from "../notification/notification.service";

export class CommentService {
  static async createComment(avitag: string, commentData: Partial<IComment>) {
    const gist = await gistRepo.findGistById(commentData.gistId!);
    if (!gist) throw ApiError.notFound("Gist not found");
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");

    if (gist.gistApproval === false) {
      const isAdmin = profile.profileType === "ADMIN";
      const isOwner = gist.avitag === avitag;
      if (!isAdmin && !isOwner) {
        throw ApiError.forbidden("Cannot comment on an unapproved gist");
      }
    }

    const comment = await commentRepo.createComment({ ...commentData, avitag });

    if (gist.avitag !== avitag) {
      await NotificationService.createNotification({
        avitag: gist.avitag,
        type: "GIST_COMMENT",
        message: `${profile.displayName} commented on your gist!`,
        referenceId: comment.commentId,
      });
    }

    return ApiSuccess.created("Comment created", comment);
  }

  static async getCommentsByGistId(gistId: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    const comments = await commentRepo.findCommentsByGistId(gistId);
    return ApiSuccess.ok("Comments fetched", comments);
  }

  static async deleteComment(commentId: string, avitag: string) {
    const comment = await commentRepo.findCommentById(commentId);
    if (!comment) throw ApiError.notFound("Comment not found");
    if (comment.avitag !== avitag)
      throw ApiError.forbidden("Not authorized to delete this comment");
    await commentRepo.deleteCommentById(commentId);
    return ApiSuccess.ok("Comment deleted");
  }
}
