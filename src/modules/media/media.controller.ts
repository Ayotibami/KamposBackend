import type { Request, Response } from "express";
import { MediaService } from "./media.service";
import { ApiError } from "../../utils/responseHandler";

export class MediaController {
  static async upload(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const { entityType, entityId, mediaType } = req.body;
    if (!req.files || !req.files.image)
      throw new ApiError(400, "No file uploaded");
    const file = Array.isArray(req.files.image)
      ? req.files.image[0]
      : req.files.image;
    const result = await MediaService.uploadMedia(
      avitag,
      entityType,
      entityId,
      mediaType,
      file
    );
    return res.status(result.status || 201).json(result);
  }

  static async getById(req: Request, res: Response) {
    const { mediaId } = req.params;
    const result = await MediaService.getMediaById(mediaId || "");
    return res.status(result.status || 200).json(result);
  }

  static async getByEntity(req: Request, res: Response) {
    const { entityType, entityId } = req.params;
    const result = await MediaService.getMediaByEntity(entityType || "", entityId || "");
    return res.status(result.status || 200).json(result);
  }

  static async update(req: Request, res: Response) {
    const { mediaId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await MediaService.updateMedia(mediaId || "", avitag, req.body);
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { mediaId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await MediaService.deleteMedia(mediaId || "", avitag);
    return res.status(result.status || 200).json(result);
  }
}
