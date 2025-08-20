import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as gistRepo from "./gist.model";
import * as profileRepo from "../profile/profile.model";
import {
  cacheTrendingGists,
  getCachedTrendingGists,
} from "../../services/redis.service";
import type { IGist } from "./gist.interface";

interface TrendingGists {
  gists: IGist[];
  total: number;
}

export class GistService {
  static async createGist(avitag: string, gistData: Partial<IGist>) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    const gist = await gistRepo.createGist({
      ...gistData,
      avitag,
      gist_approval: false,
    });
    return ApiSuccess.created("Gist created", gist);
  }

  static async getAllGists(
    page: number,
    limit: number,
    isAdmin: boolean = false
  ) {
    const { gists, total } = await gistRepo.findAllGists(page, limit, isAdmin);
    return ApiSuccess.ok("Gists fetched", { gists, total });
  }

  static async getGistById(gist_id: string, isAdmin: boolean = false) {
    const gist = await gistRepo.findGistById(gist_id, isAdmin);
    if (!gist) throw ApiError.notFound("Gist not found");
    return ApiSuccess.ok("Gist fetched", gist);
  }

  static async updateGist(
    gist_id: string,
    avitag: string,
    updates: Partial<IGist>
  ) {
    const gist = await gistRepo.findGistById(gist_id, true);
    if (!gist) throw ApiError.notFound("Gist not found");
    if (gist.avitag !== avitag)
      throw ApiError.forbidden("Not authorized to edit this gist");
    const updated = await gistRepo.updateGistById(gist_id, updates);
    if (!updated) throw ApiError.notFound("Gist not found");
    return ApiSuccess.ok("Gist updated", updated);
  }

  static async deleteGist(gist_id: string, avitag: string) {
    const gist = await gistRepo.findGistById(gist_id, true);
    if (!gist) throw ApiError.notFound("Gist not found");
    if (gist.avitag !== avitag)
      throw ApiError.forbidden("Not authorized to delete this gist");
    await gistRepo.deleteGistById(gist_id);
    return ApiSuccess.ok("Gist deleted");
  }

  static async getGistsByAvitag(avitag: string) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    const gists = await gistRepo.findGistsByAvitag(avitag);
    return ApiSuccess.ok("Gists fetched", gists);
  }

  static async getTrendingGists(
    page: number,
    limit: number,
    timeRange: string
  ) {
    const cacheKey = `trending_gists:${page}:${limit}:${timeRange}`;
    const cached = await getCachedTrendingGists();
    if (cached && cached.gists && cached.total) {
      return ApiSuccess.ok("Trending gists fetched from cache", cached);
    }

    const { gists, total } = await gistRepo.findTrendingGists(
      page,
      limit,
      timeRange
    );
    await cacheTrendingGists({ gists, total });
    return ApiSuccess.ok("Trending gists fetched", { gists, total });
  }

  static async searchGists(query: string, page: number, limit: number) {
    const { gists, total } = await gistRepo.searchGists(query, page, limit);
    return ApiSuccess.ok("Search results fetched", { gists, total });
  }

  static async approveGist(avitag: string, gist_id: string, approved: boolean) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profile_type !== "ADMIN")
      throw ApiError.forbidden("Only admins can approve gists");
    const gist = await gistRepo.findGistById(gist_id, true);
    if (!gist) throw ApiError.notFound("Gist not found");
    const updated = await gistRepo.approveGist(gist_id, approved);
    if (!updated) throw ApiError.notFound("Gist not found");
    return ApiSuccess.ok(
      `Gist ${approved ? "approved" : "disapproved"}`,
      updated
    );
  }

  static async getReportedGists(avitag: string) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profile_type !== "ADMIN")
      throw ApiError.forbidden("Only admins can view reported gists");
    const gists = await gistRepo.findReportedGists();
    return ApiSuccess.ok("Reported gists fetched", gists);
  }
}

export const gistService = GistService;
