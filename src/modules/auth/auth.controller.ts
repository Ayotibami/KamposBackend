import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import * as ProfileUtils from '../profile/utils';
import { env } from '../../config/env';
import { revokeToken } from './token.service';

export const AuthController = {
  register: async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }
    try {
      const { account, token } = await AuthService.register(email, password);
      return res.status(201).json({ success: true, data: { account, token } });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Registration failed' });
    }
  },

  login: async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }
    try {
      const { account, token } = await AuthService.login(email, password);
      return res.json({ success: true, data: { account, token } });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Login failed' });
    }
  },

  switchProfile: async (req: Request, res: Response) => {
    if (!req.user?.account_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { avitag } = req.body || {};
    if (!avitag) {
      return res.status(400).json({ success: false, message: 'avitag is required' });
    }
    const profile = await ProfileUtils.findByAvitag(avitag);
    if (!profile || profile.account_id !== req.user.account_id) {
      return res.status(404).json({ success: false, message: 'Profile not found for this account' });
    }
    if (!profile.is_verified) {
      return res.status(403).json({ success: false, message: 'Profile not verified yet' });
    }

    const adminIds = (env.ADMIN_ACCOUNT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const role = adminIds.includes(req.user.account_id) ? 'IDIOT' : 'USER';
    const token = await AuthService.issueTokenForProfile({
      account_id: req.user.account_id,
      avitag: profile.avitag,
      profileType: profile.profile_type,
      role,
    });

    return res.json({ success: true, data: { token, avitag: profile.avitag, profileType: profile.profile_type } });
  },

  logout: async (req: Request, res: Response) => {
    // Must be authenticated to logout
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { jti, exp } = req.user;
    if (!jti || !exp) {
      // If missing identifiers, just respond ok without revocation
      return res.json({ success: true, message: 'Logged out' });
    }
    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = Math.max(1, exp - now);
    await revokeToken(jti, ttlSeconds);
    return res.json({ success: true, message: 'Logged out' });
  },
};
