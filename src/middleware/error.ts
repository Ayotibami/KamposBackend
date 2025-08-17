import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import { MongoError } from "mongodb";
import { env } from "../config/env.config";
import logger from "../utils/logger";

interface MongoDuplicateKeyError extends MongoError {
  keyValue?: Record<string, string>;
}

// Middleware to handle general errors
export const errorMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (env.NODE_ENV !== "production") {
    logger.fatal(err.message);
  }

  let status_code = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let status = err.status || "Error";

  // Cast error to MongoDuplicateKeyError to access keyValue
  const { code, keyValue } = err;

  // Handle MongoDB unique key error (e.g., duplicate email)
  if (code === 11000 && keyValue) {
    status_code = 409;
    const { email } = keyValue;
    if (email) {
      message = "User with this email already exists";
    }
  }

  // General error response
  return void res.status(status_code).json({
    success: false,
    status,
    status_code,
    message,
    stack: env.NODE_ENV === "production" ? undefined : err.stack,
  });
};
