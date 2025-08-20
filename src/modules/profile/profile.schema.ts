import { z } from "zod";

export const studentSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  campus_tag: z.string().optional(),
  major_tag: z.string().optional(),
  degree: z.enum(["Bachelors", "Masters", "Phd"]).optional(),
  level: z.enum(["100", "200", "300", "400", "500"]).optional(),
  bio: z.string().optional(),
  hobbies: z.array(z.string()).optional(),
  profile_picture_url: z.string().optional(),
});

export const kompanySchema = z.object({
  display_name: z.string().min(1, "Display name is required"),
  email: z.string().email("Invalid email"),
  phone_number: z.string().min(1, "Phone number is required"),
  description: z.string().optional(),
  logo_url: z.string().min(1, "Logo URL is required"),
  website: z.string().min(1, "Website is required"),
  social_links: z.record(z.string()).optional(),
});

export const schoolSchema = z.object({
  display_name: z.string().min(1, "Display name is required"),
  description: z.string().optional(),
  campus_tag: z.string().optional(),
  logo_url: z.string().optional(),
  website: z.string().optional(),
});

export const creatorSchema = z.object({
  display_name: z.string().min(1, "Display name is required"),
  description: z.string().optional(),
  campus_tag: z.string().optional(),
  profile_image: z.string().optional(),
  engagement_score: z.number().optional(),
  earnings_balance: z.number().optional(),
  monetization_enabled: z.boolean().optional(),
  top_gist_id: z.string().uuid().optional(),
});

export const adminSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  description: z.string().optional(),
  profile_image: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "MODERATOR", "CONTENT_REVIEWER", "SUPPORT"], {
    errorMap: () => ({ message: "Invalid role" }),
  }),
  permissions: z.array(z.string(), {
    required_error: "Permissions are required",
  }),
});
