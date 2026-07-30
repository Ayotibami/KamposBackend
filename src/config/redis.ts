import { createClient } from "redis";
import { env } from "./env";
import logger from "../utils/logger";

export const redis = createClient({
  url: env.REDIS_URL,
  // Without this, commands issued while disconnected (e.g. Redis is down or
  // still retrying its first connect) queue up and wait indefinitely instead
  // of failing fast — which is what let a dead Redis host hang every
  // isRevoked() call forever. Failing fast is what lets token.service.ts
  // catch the error and fail open instead of hanging the request.
  disableOfflineQueue: true,
  socket: {
    // Capped exponential backoff instead of node-redis's default, which
    // effectively hammers a dead host forever (this is what the repeated
    // "Redis Client Error" logs during the failed deploy were).
    reconnectStrategy: (retries) => Math.min(1000 * 2 ** retries, 30_000),
  },
});

redis.on("error", (err) => logger.error({ err }, "Redis Client Error"));

/**
 * Deliberately not awaited by the caller (see index.ts) — the server should
 * come up and start serving requests even if Redis is unreachable at boot.
 * Auth still works while disconnected: isRevoked()/revokeToken() fail open
 * (see token.service.ts), so the only degradation during a Redis outage is
 * that a just-logged-out token stays valid until it naturally expires, not
 * that the whole API goes down waiting on a connection that may never come.
 */
export function connectRedis(): Promise<void> {
  return redis.connect().then(
    () => {
      logger.info("Connected to Redis");
    },
    (err) => {
      logger.error({ err }, "Redis initial connect failed — continuing without it, will keep retrying in the background");
    },
  );
}
