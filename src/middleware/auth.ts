import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../config/token.js";
import asyncWrapper from "./asyncWrapper.js";
import { ApiError } from "../utils/responseHandler.js";
import * as profileRepo from "../modules/profile/profile.model";

const isAuth = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("No Token Provided");
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token as string);

    req.user = payload;
    next();
  }
);

const requireAdmin = asyncWrapper(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user) throw ApiError.unauthorized("Not authenticated");

    if (user.profile_type === "ADMIN") return next();

    if (!user.avitag) throw ApiError.forbidden("Admin access required");
    const profile = await profileRepo.findProfileByAvitag(user.avitag);
    if (!profile || profile.profile_type !== "ADMIN") {
      throw ApiError.forbidden("Admin access required");
    }
    next();
  }
);

export { isAuth, requireAdmin };
