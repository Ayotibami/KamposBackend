import "dotenv/config";
import { cleanEnv, str, num } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "production", "test"],
    default: "development",
  }),
  PORT: num({ default: 8080 }),

  POSTGRES_URI: str(),

  JWT_SECRET: str(),
  // Short-lived access token — kept small on purpose now that a refresh
  // token exists to silently renew it; a stolen access token only stays
  // useful for 15 minutes instead of 30 days.
  ACCESS_TOKEN_EXPIRES: num({ default: 60 * 15 }), // 15 minutes in seconds
  REFRESH_TOKEN_SECRET: str({ default: "" }), // falls back to JWT_SECRET if unset
  // Refresh token lifetime — kept long so users stay logged in for weeks
  // without needing to re-authenticate (like real social media apps).
  // The short-lived access token (15 min) is silently renewed from this
  // refresh token on every request, so the user never notices.
  REFRESH_TOKEN_EXPIRES_DAYS: num({ default: 90 }),

  // Comma-separated list of allowed origins for credentialed (cookie)
  // requests — "*" is incompatible with cookies, browsers reject the
  // combination of Access-Control-Allow-Origin: * with credentials.
  CORS_ORIGIN: str({ default: "http://localhost:3000" }),
  SERVER_BASE_URL: str({ default: "" }),
  CLIENT_BASE_URL: str({ default: "" }),

  REDIS_URL: str({
    default:
      "redis://default:CmntO6R9Dxk6a54RxPfTBDaoOd4raKxE@redis-14264.c52.us-east-1-4.ec2.cloud.redislabs.com:14264",
  }),
  REDIS_HOST: str({
    default: "redis-14264.c52.us-east-1-4.ec2.cloud.redislabs.com",
  }),

  BREVO_EMAIL: str({ default: "" }),
  BREVO_PASSWORD: str({ default: "" }),
  BREVO_FROM: str({ default: "" }),

  CLOUDINARY_NAME: str({ default: "" }),
  CLOUDINARY_API_KEY: str({ default: "" }),
  CLOUDINARY_API_SECRET: str({ default: "" }),
  DEFAULT_PROFILE_PIC_URL: str({ default: "" }),
  // Matches the frontend's own LIMITS.gist (kampos-web/src/lib/brand.ts) —
  // unverified previously defaulted to 280, which silently rejected any
  // create/edit past that even though the compose UI capped at (and showed)
  // 700 the whole time.
  UNVERIFIED_GIST_MAX: num({ default: 700 }),
  VERIFIED_GIST_MAX: num({ default: 5000 }),

  GOOGLE_CLIENT_ID: str({ default: "" }),
  GOOGLE_CLIENT_SECRET: str({ default: "" }),
  FACEBOOK_CLIENT_ID: str({ default: "" }),
  FACEBOOK_CLIENT_SECRET: str({ default: "" }),
  APPLE_CLIENT_ID: str({ default: "" }),
  APPLE_TEAM_ID: str({ default: "" }),
  APPLE_KEY_ID: str({ default: "" }),
  APPLE_PRIVATE_KEY: str({ default: "" }),
  OAUTH_ENC_KEY: str({ default: "" }),

  SENTRY_DSN: str({ default: "" }),
  FCM_SERVER_KEY: str({ default: "" }),

  // Web Push (admin notifications) — a browser-native standard, not a
  // third-party service: these keys let this backend sign push payloads
  // itself and send them straight to whichever push relay the subscriber's
  // own browser vendor already runs (Chrome/Firefox/Edge's, etc.), with no
  // account or SDK from a provider like OneSignal/Firebase involved.
  // Generated once via `npx web-push generate-vapid-keys`; empty defaults
  // so a machine without them configured just can't send pushes yet,
  // rather than crashing on boot.
  VAPID_PUBLIC_KEY: str({ default: "" }),
  VAPID_PRIVATE_KEY: str({ default: "" }),
  // The `mailto:` contact VAPID requires in every push's signed JWT so a
  // push service operator has a way to reach whoever's sending, if needed.
  VAPID_SUBJECT: str({ default: "mailto:kamposkonnect@gmail.com" }),
});

export const REFRESH_TOKEN_EXPIRES_SECONDS =
  env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60;
