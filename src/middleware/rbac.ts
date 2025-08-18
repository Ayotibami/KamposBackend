import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/responseHandler";
import * as profileRepo from "../modules/profile/profile.model";

export const restrictTo = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const avitag = (req as any).user?.avitag;
    if (!avitag) throw ApiError.unauthorized("No user provided");

    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");

    if (!allowedRoles.includes(profile.profileType!)) {
      throw ApiError.forbidden(
        `Only ${allowedRoles.join(", ")} roles are allowed`
      );
    }

    next();
  };
};

export const hasPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const avitag = (req as any).user?.avitag;
    if (!avitag) throw ApiError.unauthorized("No user provided");

    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");

    if (profile.profileType === "ADMIN") {
      const adminPermissions = profile.socialLinks?.permissions;
      if (!adminPermissions?.includes(permission)) {
        throw ApiError.forbidden(`Permission ${permission} required`);
      }
    }

    next();
  };
};
