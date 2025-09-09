import { redis } from '../../config/redis';

const key = (jti: string) => `jwt:blacklist:${jti}`;

export async function revokeToken(jti: string, ttlSeconds: number) {
  // Store a marker for jti with expiration equal to remaining token lifetime
  await redis.set(key(jti), 'revoked', { EX: Math.max(1, Math.floor(ttlSeconds)) });
}

export async function isRevoked(jti?: string | null): Promise<boolean> {
  if (!jti) return false; // If no jti, we cannot check blacklist (treat as not revoked)
  const val = await redis.get(key(jti));
  return val === 'revoked';
}
