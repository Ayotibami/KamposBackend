import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/responseHandler";
import * as profileRepo from "../modules/profile/profile.model";

export const restrictTo = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const avitag = (req as any).user?.avitag;
    if (!avitag) throw ApiError.unauthorized("No user provided");

    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");

    if (!allowedRoles.includes((profile as any).profile_type!)) {
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

    if ((profile as any).profile_type === "ADMIN") {
      // permissions stored as JSONB on admin_profiles.permissions
      const permsField = (profile as any).permissions;
      const perms: string[] = Array.isArray(permsField)
        ? permsField
        : Array.isArray(permsField?.permissions)
        ? permsField.permissions
        : [];
      if (!perms.includes(permission)) {
        throw ApiError.forbidden(`Permission ${permission} required`);
      }
    }

    next();
  };
};
