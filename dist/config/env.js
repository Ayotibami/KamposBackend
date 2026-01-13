"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const envalid_1 = require("envalid");
exports.env = (0, envalid_1.cleanEnv)(process.env, {
    NODE_ENV: (0, envalid_1.str)({ choices: ['development', 'production', 'test'], default: 'development' }),
    PORT: (0, envalid_1.num)({ default: 8080 }),
    POSTGRES_URI: (0, envalid_1.str)(),
    JWT_SECRET: (0, envalid_1.str)(),
    JWT_EXPIRES: (0, envalid_1.num)({ default: 60 * 60 * 24 * 30 }), // 30 days in seconds
    CORS_ORIGIN: (0, envalid_1.str)({ default: '*' }),
    SERVER_BASE_URL: (0, envalid_1.str)({ default: '' }),
    CLIENT_BASE_URL: (0, envalid_1.str)({ default: '' }),
    REDIS_URL: (0, envalid_1.str)({ default: 'redis://localhost:6379' }),
    REDIS_HOST: (0, envalid_1.str)({ default: 'localhost' }),
    BREVO_EMAIL: (0, envalid_1.str)({ default: '' }),
    BREVO_PASSWORD: (0, envalid_1.str)({ default: '' }),
    BREVO_FROM: (0, envalid_1.str)({ default: '' }),
    CLOUDINARY_NAME: (0, envalid_1.str)({ default: '' }),
    CLOUDINARY_API_KEY: (0, envalid_1.str)({ default: '' }),
    CLOUDINARY_API_SECRET: (0, envalid_1.str)({ default: '' }),
    DEFAULT_PROFILE_PIC_URL: (0, envalid_1.str)({ default: '' }),
    ADMIN_ACCOUNT_IDS: (0, envalid_1.str)({ default: '' }),
    UNVERIFIED_GIST_MAX: (0, envalid_1.num)({ default: 280 }),
    VERIFIED_GIST_MAX: (0, envalid_1.num)({ default: 5000 }),
    GOOGLE_CLIENT_ID: (0, envalid_1.str)({ default: '' }),
    GOOGLE_CLIENT_SECRET: (0, envalid_1.str)({ default: '' }),
    FACEBOOK_CLIENT_ID: (0, envalid_1.str)({ default: '' }),
    FACEBOOK_CLIENT_SECRET: (0, envalid_1.str)({ default: '' }),
    APPLE_CLIENT_ID: (0, envalid_1.str)({ default: '' }),
    APPLE_TEAM_ID: (0, envalid_1.str)({ default: '' }),
    APPLE_KEY_ID: (0, envalid_1.str)({ default: '' }),
    APPLE_PRIVATE_KEY: (0, envalid_1.str)({ default: '' }),
    OAUTH_ENC_KEY: (0, envalid_1.str)({ default: '' }),
    SENTRY_DSN: (0, envalid_1.str)({ default: '' }),
    FCM_SERVER_KEY: (0, envalid_1.str)({ default: '' }),
});
