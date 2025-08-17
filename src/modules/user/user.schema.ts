import { z } from "zod";

export const userSchema = z
  .object({
    userName: z
      .string({ required_error: "Username is required" })
      .min(2, "Username must be at least 2 characters long"),

    lastName: z
      .string({ required_error: "Last name is required" })
      .min(2, "Last name must be at least 2 characters long"),

    phoneNumber: z
      .string({ required_error: "Phone number is required" })
      .regex(
        /^(0)(7|8|9){1}(0|1){1}[0-9]{8}$/,
        "Please provide a valid Nigerian phone number"
      ),

    email: z
      .string({ required_error: "Email is required" })
      .email("Please provide a valid email address"),

    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters long"),
  })
  .strict();
