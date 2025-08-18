import type { Document, ObjectId } from "mongoose";

export type UserRolesEnum = ("user" | "admin" | "driver")[];

export interface IUser {
  id?: number; // primary key from Postgres
  userName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password?: string;
  isActive: boolean;
  isVerified: boolean;
  roles: ("user" | "admin")[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthenticatedUser {
  userId: number | string;
  avitag: string;
  roles: ("user" | "admin")[];
  email?: string;
}
