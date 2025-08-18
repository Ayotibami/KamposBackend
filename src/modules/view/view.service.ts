import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as viewRepo from "./view.model";
import * as gistRepo from "../gist/gist.model";
import type { IView } from "./view.interface";

export class ViewService {
  static async createView(avitag: string, gistId: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    const existingViews = await viewRepo.findViewsByGistId(gistId);
    if (existingViews.some((view) => view.avitag === avitag)) {
      throw ApiError.badRequest("View already recorded");
    }
    const view = await viewRepo.createView({ gistId, avitag });
    return ApiSuccess.created("View recorded", view);
  }

  static async getViewsByGistId(gistId: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    const views = await viewRepo.findViewsByGistId(gistId);
    return ApiSuccess.ok("Views fetched", views);
  }

  static async getViewCountByGistId(gistId: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    const count = await viewRepo.countViewsByGistId(gistId);
    return ApiSuccess.ok("View count fetched", { gistId, count });
  }
}
