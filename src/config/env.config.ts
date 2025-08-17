import { str } from "envalid";

export const env = {
  // Postgres / server
  POSTGRES_URI: process.env.POSTGRES_URI || "",
  PORT: Number(process.env.PORT || 8080),
  NODE_ENV: str({
    choices: ["development", "production", "test"],
  }),

  // JWT / sessions
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES: process.env.JWT_EXPIRES || "86400", // seconds
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "",
  REFRESH_TOKEN_EXPIRES_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "30"),

  // CORS / URLs
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  SERVER_BASE_URL: process.env.SERVER_BASE_URL || "",
  CLIENT_BASE_URL: process.env.CLIENT_BASE_URL || "",

  // Email / providers
  BREVO_EMAIL: process.env.BREVO_EMAIL || "",
  BREVO_PASSWORD: process.env.BREVO_PASSWORD || "",

  // Cloudinary
  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  // OAuth (fill these in your .env)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID || "",
  FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET || "",
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || "",         // Service ID / Client ID
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || "",
  APPLE_KEY_ID: process.env.APPLE_KEY_ID || "",
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY || "",     // PEM string (escape/newline in .env)

  // Rate limiting / security tuning
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX || 100),
} as const;
