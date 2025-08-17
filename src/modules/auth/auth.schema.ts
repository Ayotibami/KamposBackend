import { z } from "zod";

export class AuthSchemas {
  static register = z
    .object({
      email: z.string({ required_error: "Email is required" }).email("Invalid email"),
      password: z.string({ required_error: "Password is required" }).min(6, "Password too short"),
      displayName: z.string().optional(),
      profileType: z.string().optional(), // validate in controller/service if needed
    })
    .strict();

  static login = z
    .object({
      email: z.string({ required_error: "Email is required" }).email("Invalid email"),
      password: z.string({ required_error: "Password is required" }).min(6),
    })
    .strict();

  static sendOTP = z.object({
    email: z.string({ required_error: "Email is required" }).email(),
  });

  static verifyOTP = z.object({
    email: z.string({ required_error: "Email is required" }).email(),
    otp: z.string({ required_error: "OTP is required" }).length(6),
  });

  static forgotPassword = z.object({
    email: z.string({ required_error: "Email is required" }).email(),
  });

  static resetPassword = z.object({
    email: z.string({ required_error: "Email is required" }).email(),
    otp: z.string({ required_error: "OTP is required" }).length(6),
    password: z.string({ required_error: "Password is required" }).min(6),
  });
}
