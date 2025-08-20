import type { Request, Response, NextFunction } from "express";
import { profileService } from "./profile.service";

export class ProfileController {
  static async createStudentProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const profileData = {
        ...req.body,
        avitag: req.user!.avitag,
        account_id: req.user!.account_id,
        profile_type: "STUDENT",
      };
      const result = await profileService.createProfile(profileData);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async createKompanyProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const profileData = {
        ...req.body,
        avitag: req.user!.avitag,
        account_id: req.user!.account_id,
        profile_type: "KOMPANY",
      };
      const result = await profileService.createProfile(profileData);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async createSchoolProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const profileData = {
        ...req.body,
        avitag: req.user!.avitag,
        account_id: req.user!.account_id,
        profile_type: "SCHOOL",
      };
      const result = await profileService.createProfile(profileData);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async createCreatorProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const profileData = {
        ...req.body,
        avitag: req.user!.avitag,
        account_id: req.user!.account_id,
        profile_type: "CREATOR",
      };
      const result = await profileService.createProfile(profileData);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async createAdminProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const profileData = {
        ...req.body,
        avitag: req.user!.avitag,
        account_id: req.user!.account_id,
        profile_type: "ADMIN",
      };
      const result = await profileService.createProfile(profileData);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getProfileByAvitag(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { avitag } = req.params;
      const result = await profileService.getProfileByAvitag(avitag);
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getProfilesByType(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const profile_type = req.params.type.toUpperCase() || "";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await profileService.getProfilesByType(
        profile_type,
        page,
        limit
      );
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { avitag } = req.params;
      const updates = req.body;
      const result = await profileService.updateProfile(
        avitag,
        updates,
        req.user!.avitag
      );
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async verifyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { avitag } = req.params;
      const result = await profileService.verifyProfile(
        avitag,
        req.user!.avitag
      );
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async deleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { avitag } = req.params;
      const result = await profileService.deleteProfile(
        avitag,
        req.user!.avitag
      );
      res.status(result.status_code).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = ProfileController;
