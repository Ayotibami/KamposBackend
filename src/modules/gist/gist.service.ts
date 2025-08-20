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
    const gist = await gistRepo.createGist({ ...gistData, avitag });
    return ApiSuccess.created("Gist created", gist);
  }

  static async getAllGists(page: number, limit: number) {
    const { gists, total } = await gistRepo.findAllGists(page, limit);
    return ApiSuccess.ok("Gists fetched", { gists, total });
  }

  static async getAllApprovedGists(page: number, limit: number) {
    const { gists, total } = await gistRepo.findAllApprovedGists(page, limit);
    return ApiSuccess.ok("Gists fetched", { gists, total });
  }

  static async getGistById(gistId: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    return ApiSuccess.ok("Gist fetched", gist);
  }

  static async getApprovedGistById(gistId: string) {
    const gist = await gistRepo.findApprovedGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found or not approved");
    return ApiSuccess.ok("Gist fetched", gist);
  }

  static async updateGist(
    gistId: string,
    avitag: string,
    updates: Partial<IGist>
  ) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    if (gist.avitag !== avitag)
      throw ApiError.forbidden("Not authorized to edit this gist");
    const updated = await gistRepo.updateGistById(gistId, updates);
    if (!updated) throw ApiError.notFound("Gist not found");
    return ApiSuccess.ok("Gist updated", updated);
  }

  static async deleteGist(gistId: string, avitag: string) {
    const gist = await gistRepo.findGistById(gistId);
    if (!gist) throw ApiError.notFound("Gist not found");
    if (gist.avitag !== avitag)
      throw ApiError.forbidden("Not authorized to delete this gist");
    await gistRepo.deleteGistById(gistId);
    return ApiSuccess.ok("Gist deleted");
  }

  static async getGistsByAvitag(avitag: string) {
    const gists = await gistRepo.findGistsByAvitag(avitag);
    return ApiSuccess.ok("Gists fetched", gists);
  }

  static async getApprovedGistsByAvitag(avitag: string) {
    const gists = await gistRepo.findApprovedGistsByAvitag(avitag);
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

  static async getTrendingApprovedGists(
    page: number,
    limit: number,
    timeRange: string
  ) {
    const { gists, total } = await gistRepo.findTrendingApprovedGists(
      page,
      limit,
      timeRange
    );
    return ApiSuccess.ok("Trending gists fetched", { gists, total });
  }

  static async searchGists(query: string, page: number, limit: number) {
    const { gists, total } = await gistRepo.searchGists(query, page, limit);
    return ApiSuccess.ok("Search results fetched", { gists, total });
  }

  static async searchApprovedGists(query: string, page: number, limit: number) {
    const { gists, total } = await gistRepo.searchApprovedGists(
      query,
      page,
      limit
    );
    return ApiSuccess.ok("Search results fetched", { gists, total });
  }

  static async approveGist(gistId: string, avitag: string) {
    const actor = await profileRepo.findProfileByAvitag(avitag);
    if (!actor) throw ApiError.notFound("Profile not found");
    if (actor.profileType !== "ADMIN")
      throw ApiError.forbidden("Only admins can approve gists");
    const updated = await gistRepo.approveGistById(gistId);
    if (!updated) throw ApiError.notFound("Gist not found");
    return ApiSuccess.ok("Gist approved", updated);
  }

  static async getPendingGists(page: number, limit: number, avitag: string) {
    const actor = await profileRepo.findProfileByAvitag(avitag);
    if (!actor) throw ApiError.notFound("Profile not found");
    if (actor.profileType !== "ADMIN")
      throw ApiError.forbidden("Only admins can view pending gists");
    const { gists, total } = await gistRepo.findPendingGists(page, limit);
    return ApiSuccess.ok("Pending gists fetched", { gists, total });
  }
}

export const gistService = GistService;
