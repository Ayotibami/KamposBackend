import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as mediaRepo from "./media.model";
import * as gistRepo from "../gist/gist.model";
import * as eventRepo from "../event/event.model";
import { UploadService } from "../../services/upload.service";
import type { IMedia } from "./media.interface";

export class MediaService {
  static async uploadMedia(
    avitag: string,
    entityType: string,
    entityId: string,
    mediaType: string,
    file: Express.Multer.File
  ) {
    // Validate entity exists
    if (entityType === "gist") {
      const gist = await gistRepo.findGistById(entityId);
      if (!gist) throw ApiError.notFound("Gist not found");
      if (gist.avitag !== avitag)
        throw ApiError.forbidden(
          "Not authorized to upload media for this gist"
        );
    } else if (entityType === "event") {
      const event = await eventRepo.findEventById(entityId);
      if (!event) throw ApiError.notFound("Event not found");
      if (!event.hostAviTags.includes(avitag))
        throw ApiError.forbidden(
          "Not authorized to upload media for this event"
        );
    }

    const mediaUrl = await UploadService.uploadToCloudinary(file.path);
    const media = await mediaRepo.createMedia({
      entityType,
      entityId,
      mediaType,
      mediaUrl,
    });
    return ApiSuccess.created("Media uploaded", media);
  }

  static async getMediaById(mediaId: string) {
    const media = await mediaRepo.findMediaById(mediaId);
    if (!media) throw ApiError.notFound("Media not found");
    return ApiSuccess.ok("Media fetched", media);
  }

  static async getMediaByEntity(entityType: string, entityId: string) {
    const media = await mediaRepo.findMediaByEntity(
      entityType as any,
      entityId
    );
    return ApiSuccess.ok("Media fetched", media);
  }

  static async updateMedia(
    mediaId: string,
    avitag: string,
    updates: Partial<IMedia>
  ) {
    const media = await mediaRepo.findMediaById(mediaId);
    if (!media) throw ApiError.notFound("Media not found");
    if (media.entityType === "gist") {
      const gist = await gistRepo.findGistById(media.entityId);
      if (gist && gist.avitag !== avitag)
        throw ApiError.forbidden("Not authorized to update this media");
    } else if (media.entityType === "event") {
      const event = await eventRepo.findEventById(media.entityId);
      if (event && !event.hostAviTags.includes(avitag))
        throw ApiError.forbidden("Not authorized to update this media");
    }
    const updated = await mediaRepo.updateMediaById(mediaId, updates);
    if (!updated) throw ApiError.notFound("Media not found");
    return ApiSuccess.ok("Media updated", updated);
  }

  static async deleteMedia(mediaId: string, avitag: string) {
    const media = await mediaRepo.findMediaById(mediaId);
    if (!media) throw ApiError.notFound("Media not found");
    if (media.entityType === "gist") {
      const gist = await gistRepo.findGistById(media.entityId);
      if (gist && gist.avitag !== avitag)
        throw ApiError.forbidden("Not authorized to delete this media");
    } else if (media.entityType === "event") {
      const event = await eventRepo.findEventById(media.entityId);
      if (event && !event.hostAviTags.includes(avitag))
        throw ApiError.forbidden("Not authorized to delete this media");
    }
    await mediaRepo.deleteMediaById(mediaId);
    return ApiSuccess.ok("Media deleted");
  }
}
