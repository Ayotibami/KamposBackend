import logger from './logger';

/**
 * Only errors deliberately thrown for a user to read — the app's own
 * convention for that is `Object.assign(new Error('...'), { statusCode })`
 * (see auth.service.ts, oauth.service.ts, otp.service.ts, password-
 * reset.service.ts) — are safe to put in an API response. Anything else
 * (a raw `pg` driver error, a TypeError from a bug, a third-party API
 * failure) was never written for a person to read and can contain
 * internal detail — table/column names, SQL fragments, stack-adjacent
 * text — that has no business reaching the frontend. The real error is
 * always logged here so it's still visible to us; the response only ever
 * gets the safe fallback in that case.
 */
export function safeErrorMessage(err: unknown, fallback: string): string {
  const e = err as { statusCode?: unknown; message?: unknown } | null | undefined;
  if (e && typeof e.statusCode === 'number' && typeof e.message === 'string' && e.message) {
    return e.message;
  }
  logger.error({ err }, 'Unsafe error message suppressed from API response');
  return fallback;
}

/** Same trust rule as safeErrorMessage, for picking the response status
 *  code — an explicit statusCode on a deliberately-thrown error is trusted,
 *  anything else defaults to 500 rather than whatever an unrelated raw
 *  error object happens to have set (a `pg` error's own numeric fields
 *  don't mean HTTP status). */
export function safeErrorStatus(err: unknown, fallback = 500): number {
  const e = err as { statusCode?: unknown } | null | undefined;
  return e && typeof e.statusCode === 'number' ? e.statusCode : fallback;
}
