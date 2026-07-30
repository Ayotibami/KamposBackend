import { redis } from '../../config/redis';
import logger from '../../utils/logger';

const key = (jti: string) => `jwt:blacklist:${jti}`;

export async function revokeToken(jti: string, ttlSeconds: number) {
  try {
    // Store a marker for jti with expiration equal to remaining token lifetime
    await redis.set(key(jti), 'revoked', { EX: Math.max(1, Math.floor(ttlSeconds)) });
  } catch (err) {
    // Redis unreachable — logout still succeeds from the client's
    // perspective (the token just won't be blacklisted, so it stays valid
    // until it naturally expires instead of being revoked immediately).
    logger.error({ err }, 'revokeToken failed — Redis unavailable');
  }
}

export async function isRevoked(jti?: string | null): Promise<boolean> {
  if (!jti) return false; // If no jti, we cannot check blacklist (treat as not revoked)
  try {
    const val = await redis.get(key(jti));
    return val === 'revoked';
  } catch (err) {
    // Fail open: an unreachable Redis shouldn't turn into every
    // authenticated request getting rejected. The tradeoff is a
    // just-logged-out token stays valid until it naturally expires during
    // an outage — acceptable next to taking the whole API down.
    logger.error({ err }, 'isRevoked check failed — Redis unavailable, treating as not revoked');
    return false;
  }
}
