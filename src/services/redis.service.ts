import { createClient } from "redis";
import { env } from "../config/env.config";
import logger from "../utils/logger";
import type { IGist } from "../modules/gist/gist.interface";

interface TrendingGists {
  gists: IGist[];
  total: number;
}

const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err) => logger.error("Redis Client Error", err));

export const connectRedis = async () => {
  await redis.connect();
  logger.info("Connected to Redis");
};

export const cacheTrendingGists = async (
  data: TrendingGists,
  ttl: number = 3600
) => {
  await redis.setEx("trending_gists", ttl, JSON.stringify(data));
};

export const getCachedTrendingGists =
  async (): Promise<TrendingGists | null> => {
    const cached = await redis.get("trending_gists");
    return cached ? JSON.parse(cached) : null;
  };

export const cacheUserSession = async (
  userId: string,
  session: any,
  ttl: number = 3600 * 24
) => {
  await redis.setEx(`session:${userId}`, ttl, JSON.stringify(session));
};

export const getCachedUserSession = async (userId: string) => {
  const cached = await redis.get(`session:${userId}`);
  return cached ? JSON.parse(cached) : null;
};
