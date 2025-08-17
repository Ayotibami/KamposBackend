import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/responseHandler";

const notFound = async (req: Request, res: Response, next: NextFunction) => {
  const notFoundError = ApiError.notFound("Route Not Found");
  next(notFoundError);
};

export default notFound;
