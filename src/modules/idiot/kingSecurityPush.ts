import * as webpushService from './webpush.service';
import logger from '../../utils/logger';

/**
 * King-only, immediate push for the security-relevant slice of admin
 * activity — NOT the general audit log (too high-volume, mostly routine),
 * just the two things that are rare AND worth interrupting a king for:
 * someone's admin powers changing, and a blocked attempt to touch a king
 * account/profile (either a bug, or someone probing boundaries).
 *
 * Fire-and-forget by design (callers use `void`, never `await`) — a
 * notification failing must never delay or break the actual request it's
 * riding alongside (a 403 response, a successful grant/revoke).
 */
export function notifyKingSecurity(body: string): void {
  webpushService
    .sendToKings({ title: "King security alert", body, url: "/villagepeople/admins" })
    .catch((err) => logger.error({ err }, "Failed to send king security push"));
}
