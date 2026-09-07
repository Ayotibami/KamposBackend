import webpush, { WebPushError } from 'web-push';
import { env } from '../../config/env';
import logger from '../../utils/logger';
import * as pushRepo from './push.repo';
import type { PushSubscriptionRow } from './push.repo';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where notificationclick (sw.js) should send the admin. */
  url: string;
}

/** Sends one payload to a batch of subscriptions, pruning any that the
 * push service reports as gone (404/410 — the browser unsubscribed, or the
 * subscription simply expired) so this table doesn't quietly accumulate
 * dead rows forever. Every send is independent (Promise.allSettled, not
 * Promise.all) — one admin's stale subscription failing must never stop
 * the push from reaching everyone else's. */
async function sendToSubscriptions(subscriptions: PushSubscriptionRow[], payload: PushPayload): Promise<void> {
  if (subscriptions.length === 0) return;
  if (!ensureConfigured()) {
    logger.warn('Web Push not configured (missing VAPID keys) — skipping send');
    return;
  }
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason;
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        dead.push(subscriptions[i].endpoint);
      } else {
        logger.error({ err, endpoint: subscriptions[i].endpoint }, 'Web push send failed');
      }
    }
  });
  if (dead.length) {
    try {
      await pushRepo.removeSubscriptionsByEndpoints(dead);
    } catch (e) {
      logger.error({ err: e }, 'Failed to prune dead push subscriptions');
    }
  }
}

export async function sendToAllAdmins(payload: PushPayload): Promise<void> {
  const subs = await pushRepo.listAdminSubscriptions();
  await sendToSubscriptions(subs, payload);
}

export async function sendToKings(payload: PushPayload): Promise<void> {
  const subs = await pushRepo.listKingSubscriptions();
  await sendToSubscriptions(subs, payload);
}
