import { createClient } from 'redis';
import { env } from './env';
import logger from '../utils/logger';

export const redis = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => logger.error({ err }, 'Redis Client Error'));

export async function connectRedis() {
  await redis.connect();
  logger.info('Connected to Redis');
}
