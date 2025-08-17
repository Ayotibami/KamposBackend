import { z } from "zod";

export class AuthSchemas {
  static register = z
    .object({
      email: z
        .string({ required_error: "Email is required" })
        .email("Please provide a valid email address"),
      password: z
        .string({ required_error: "Password is required" })
        .min(5, "Password must be at least 5 characters long"),
    })
    .strict();

  static login = z
    .object({
      email: z
        .string({ required_error: "Email is required" })
        .email("Please provide a valid email address"),
      password: z
        .string({ required_error: "Password is required" })
        .min(5, "Password must be at least 5 characters long"),
    })
    .strict();

  static verifyOTP = z
    .object({
      email: z
        .string({ required_error: "Email is required" })
        .email("Please provide a valid email address"),
      otp: z
        .string({ required_error: "otp is required" })
        .min(4, "otp must be at least 5 characters long"),
    })
    .strict();

  static sendOTP = z
    .object({
      email: z
        .string({ required_error: "Email is required" })
        .email("Please provide a valid email address"),
    })
    .strict();

  static forgotPassword = z
    .object({
      email: z
        .string({ required_error: "Email is required" })
        .email("Please provide a valid email address"),
    })
    .strict();

  static resetPassword = z
    .object({
      email: z
        .string({ required_error: "Email is required" })
        .email("Please provide a valid email address"),
      otp: z
        .string({ required_error: "otp is required" })
        .min(4, "otp must be at least 4 characters long"),
      password: z
        .string({ required_error: "Password is required" })
        .min(5, "Password must be at least 5 characters long"),
    })
    .strict();
}
