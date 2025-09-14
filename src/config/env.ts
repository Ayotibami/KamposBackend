import 'dotenv/config';
import { cleanEnv, str, num } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: num({ default: 8080 }),

  POSTGRES_URI: str(),

  JWT_SECRET: str(),
  JWT_EXPIRES: num({ default: 60 * 60 * 24 * 30 }), // 30 days in seconds

  CORS_ORIGIN: str({ default: '*' }),
  SERVER_BASE_URL: str({ default: '' }),
  CLIENT_BASE_URL: str({ default: '' }),

  REDIS_URL: str({ default: 'redis://localhost:6379' }),
  REDIS_HOST: str({ default: 'localhost' }),

  BREVO_EMAIL: str({ default: '' }),
  BREVO_PASSWORD: str({ default: '' }),
  BREVO_FROM: str({ default: '' }),

  CLOUDINARY_NAME: str({ default: '' }),
  CLOUDINARY_API_KEY: str({ default: '' }),
  CLOUDINARY_API_SECRET: str({ default: '' }),
  DEFAULT_PROFILE_PIC_URL: str({ default: '' }),
  ADMIN_ACCOUNT_IDS: str({ default: '' }),
  UNVERIFIED_GIST_MAX: num({ default: 280 }),
  VERIFIED_GIST_MAX: num({ default: 5000 }),

  GOOGLE_CLIENT_ID: str({ default: '' }),
  GOOGLE_CLIENT_SECRET: str({ default: '' }),
  FACEBOOK_CLIENT_ID: str({ default: '' }),
  FACEBOOK_CLIENT_SECRET: str({ default: '' }),
  APPLE_CLIENT_ID: str({ default: '' }),
  APPLE_TEAM_ID: str({ default: '' }),
  APPLE_KEY_ID: str({ default: '' }),
  APPLE_PRIVATE_KEY: str({ default: '' }),

  SENTRY_DSN: str({ default: '' }),
  FCM_SERVER_KEY: str({ default: '' }),
});
