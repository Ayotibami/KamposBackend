import mongoose from "mongoose";
import { ApiError } from "./responseHandler";

// Hash password
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw ApiError.badRequest("Please provide a password");
  }
  const hashedPassword = await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
  return hashedPassword;
}

// Compares password
export async function comparePassword(
  incomingPassword: string,
  existingPassword: string
): Promise<void> {
  if (!incomingPassword || !existingPassword) {
    throw ApiError.badRequest("Please provide a password");
  }
  const isMatch = await Bun.password.verify(incomingPassword, existingPassword);
  if (!isMatch) {
    throw ApiError.unauthorized("Unauthorized");
  }
}

// Checks if an id is a valid mongoose Id
export function validateMongoId(id: string): void {
  const isValid = mongoose.isValidObjectId(id);
  if (!isValid) {
    throw ApiError.badRequest("Invalid Id");
  }
}
