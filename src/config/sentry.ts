import * as Sentry from "@sentry/node";
import { env } from "./env.config";

export const initSentry = () => {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: String(env.NODE_ENV),
  });
};
