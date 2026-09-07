import { redis } from '../../config/redis';
import logger from '../../utils/logger';
import { REFRESH_TOKEN_EXPIRES_SECONDS } from '../../config/env';

const key = (jti: string) => `jwt:blacklist:${jti}`;
const accountRevocationKey = (account_id: string) => `account:revoked_before:${account_id}`;

async function writeRevocation(jti: string, ttlSeconds: number) {
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

/**
 * `graceSeconds` delays the blacklist write itself (not just the token's
 * own natural expiry) — used by refresh-token rotation, where a handful of
 * requests sharing the same still-valid old token can legitimately race
 * each other (Next.js link-prefetch + the real navigation, both hitting
 * the SSR refresh middleware around the same access-token expiry). Without
 * a grace window, the first one to land "wins" and every other one gets
 * treated as reuse of an already-revoked token — a real user getting
 * bounced to /login for a session that's still perfectly valid. Explicit
 * logout (the other caller of this function) never passes a grace period:
 * that one has to kill the token immediately.
 */
export async function revokeToken(jti: string, ttlSeconds: number, graceSeconds = 0) {
  if (graceSeconds > 0) {
    setTimeout(() => {
      void writeRevocation(jti, ttlSeconds);
    }, graceSeconds * 1000);
    return;
  }
  await writeRevocation(jti, ttlSeconds);
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

/**
 * The per-jti blacklist above only ever knows the CURRENT request's own
 * access+refresh jtis (see logout) — nothing tracks which jtis belong to
 * which account, so there's no way to enumerate and revoke every session
 * a suspended/deactivated/deleted account might have open on other
 * devices. This is the bulk equivalent: a single per-account timestamp
 * marker, checked against a token's own `iat` rather than its `jti` — any
 * token issued before the marker is treated as revoked, regardless of
 * which device or how many are out there. TTL matches the refresh token's
 * own lifetime so the marker naturally expires once nothing issued before
 * it could still be presented anyway (same self-cleaning approach as the
 * per-jti blacklist's own TTL-equals-remaining-lifetime trick).
 */
export async function revokeAllForAccount(account_id: string): Promise<void> {
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    await redis.set(accountRevocationKey(account_id), String(nowSeconds), {
      EX: REFRESH_TOKEN_EXPIRES_SECONDS,
    });
  } catch (err) {
    // Fail open, same as everywhere else in this file — an unreachable
    // Redis shouldn't block the suspend/delete/deactivate action itself
    // (the account_status check at login/refresh still catches it; this
    // marker is the "kill an already-active session immediately" layer,
    // not the only enforcement).
    logger.error({ err }, 'revokeAllForAccount failed — Redis unavailable');
  }
}

export async function isAccountRevoked(account_id?: string | null, iat?: number | null): Promise<boolean> {
  if (!account_id || !iat) return false;
  try {
    const val = await redis.get(accountRevocationKey(account_id));
    if (!val) return false;
    return iat < Number(val);
  } catch (err) {
    logger.error({ err }, 'isAccountRevoked check failed — Redis unavailable, treating as not revoked');
    return false;
  }
}
