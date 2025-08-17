import { cleanEnv, port, str } from "envalid";

export const env = cleanEnv(Bun.env, {
  MONGODB_URI: str(),
  BREVO_EMAIL: str(),
  BREVO_PASSWORD: str(),
  NODE_ENV: str({
    choices: ["development", "production", "test"],
  }),
  PORT: port(),
  JWT_SECRET: str(),
  JWT_EXPIRES: str(),
  CORS_ORIGIN: str(),
  SERVER_BASE_URL: str(),
  CLIENT_BASE_URL: str(),
  CLOUNINARY_NAME: str(),
  CLOUNINARY_API_KEY: str(),
  CLOUNINARY_API_SECRET: str(),
});
