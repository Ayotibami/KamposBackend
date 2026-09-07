import type { Request, Response } from 'express';
import * as pushRepo from './push.repo';
import { env } from '../../config/env';

export const PushController = {
  /** Hands the browser the public key it needs to open a subscription
   * (pushManager.subscribe's applicationServerKey) — kept server-side and
   * fetched rather than baked into the frontend build, so rotating the
   * VAPID keys is a config change on this backend, not a redeploy of the
   * frontend too. */
  publicKey: async (_req: Request, res: Response) => {
    res.json({ success: true, data: { publicKey: env.VAPID_PUBLIC_KEY } });
  },

  subscribe: async (req: Request, res: Response) => {
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== 'string' || !endpoint) {
      return res.status(400).json({ success: false, message: 'endpoint is required' });
    }
    if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
      return res.status(400).json({ success: false, message: 'keys.p256dh and keys.auth are required' });
    }
    await pushRepo.upsertSubscription(req.user!.account_id, endpoint, keys.p256dh, keys.auth);
    return res.json({ success: true, message: 'Subscribed' });
  },

  unsubscribe: async (req: Request, res: Response) => {
    const { endpoint } = req.body || {};
    if (typeof endpoint !== 'string' || !endpoint) {
      return res.status(400).json({ success: false, message: 'endpoint is required' });
    }
    await pushRepo.removeSubscription(endpoint);
    return res.json({ success: true, message: 'Unsubscribed' });
  },
};
