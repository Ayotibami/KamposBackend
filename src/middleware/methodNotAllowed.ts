import type { Request, Response } from "express";
import { ApiError } from "../utils/responseHandler";

const methodNotAllowed = (req: Request, res: Response) => {
  throw ApiError.methodNotAllowed(
    `Method ${req.method} not allowed on ${req.originalUrl}`
  );
};

export default methodNotAllowed;
