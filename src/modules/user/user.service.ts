import type { ObjectId } from "mongoose";
import { ApiError } from "../../utils/responseHandler";
import { hashPassword } from "../../utils/validationUtils";
import type { RegisterDTO } from "../auth/auth.interface";
import type { IUser } from "./user.interface";
import * as userRepo from "./user.model";

class UserService {
  static async createUser(userData: RegisterDTO & Partial<IUser>): Promise<IUser> {
    const { password, email, phoneNumber, userName, lastName } = userData;

    const hashedPassword = await hashPassword(password as string);

    const created = await userRepo.createUser({
      userName,
      lastName,
      phoneNumber,
      email,
      password: hashedPassword,
      isActive: true,
      isVerified: false,
      roles: ["user"],
    });

    return created;
  }

  static async findUserByEmail(email: string): Promise<IUser> {
    const user = await userRepo.findUserByEmail(email);
    if (!user) {
      throw ApiError.notFound("No user with this email");
    }
    return user;
  }

  static async findUserById(userId: number | string): Promise<IUser> {
    const idNum = typeof userId === "string" ? Number(userId) : userId;
    if (Number.isNaN(Number(idNum))) {
      throw ApiError.badRequest("Invalid user id");
    }
    const user = await userRepo.findUserById(Number(idNum));
    if (!user) {
      throw ApiError.notFound("User Not Found");
    }
    return user;
  }

  static async checkIfUserExists(email: string): Promise<void> {
    const user = await userRepo.findUserByEmail(email);
    if (user) {
      throw ApiError.badRequest("User with this email exists");
    }
  }

  static async updateUser(userId: number, updates: Partial<IUser>): Promise<IUser> {
    const updated = await userRepo.updateUserById(userId, updates);
    if (!updated) throw ApiError.notFound("User Not Found");
    return updated;
  }
}

export default UserService;
