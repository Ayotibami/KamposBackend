import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import * as ProfileUtils from '../profile/utils';
import { toPublicAccount } from '../account/account.repo';
import { env } from '../../config/env';
import { revokeToken, isRevoked } from './token.service';
import { verifyRefreshToken } from '../../config/jwt';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../../utils/authCookies';

export const AuthController = {
  register: async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }
    try {
      const { account, accessToken, refreshToken } = await AuthService.register(email, password);
      setAuthCookies(res, accessToken, refreshToken);
      return res.status(201).json({ success: true, data: { account: toPublicAccount(account) } });
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
      const { account, accessToken, refreshToken } = await AuthService.login(email, password);
      setAuthCookies(res, accessToken, refreshToken);
      return res.json({ success: true, data: { account: toPublicAccount(account) } });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Login failed' });
    }
  },

  // Silently mints a new access+refresh pair from a still-valid refresh
  // token, so a session can outlive the short access-token lifetime without
  // asking the user to log in again. Rotates the refresh token on every use
  // (old one revoked, new one issued) — if a stolen refresh token is ever
  // used, the legitimate user's next refresh attempt will fail (since
  // theirs was just revoked by the thief's use), which is at least a
  // detectable signal rather than a silently-forever-valid stolen token.
  refresh: async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }
    try {
      const payload = verifyRefreshToken(token);
      if (await isRevoked(payload.jti)) {
        clearAuthCookies(res);
        return res.status(401).json({ success: false, message: 'Refresh token revoked' });
      }
      if (payload.jti && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        await revokeToken(payload.jti, Math.max(1, payload.exp - now));
      }
      const { account_id, avitag, profileType, who } = payload;
      if (!account_id) {
        clearAuthCookies(res);
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      }
      // Re-derive role from the current admin list rather than trusting
      // whatever was baked into the old refresh token's claims — otherwise
      // someone removed from ADMIN_ACCOUNT_IDS keeps IDIOT privileges on
      // every refresh for as long as their existing session lasts (up to
      // REFRESH_TOKEN_EXPIRES_DAYS), since this endpoint would never
      // re-check. is_otp_verified is re-derived from the DB too, same
      // reasoning — issueTokenForProfile already does that part.
      const adminIds = (env.ADMIN_ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
      const role = who === 'king' ? 'king' : adminIds.includes(account_id) ? 'IDIOT' : 'USER';
      const { accessToken, refreshToken } = await AuthService.issueTokenForProfile({
        account_id,
        avitag,
        profileType,
        role,
        who,
      });
      setAuthCookies(res, accessToken, refreshToken);
      return res.json({ success: true, message: 'Refreshed' });
    } catch (err) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
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
    // if (!profile.is_verified) {
    //   return res.status(403).json({ success: false, message: 'Profile not verified yet' });
    // }


    const adminIds = (env.ADMIN_ACCOUNT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const role = adminIds.includes(req.user.account_id) ? 'IDIOT' : 'USER';
    const { accessToken, refreshToken } = await AuthService.issueTokenForProfile({
      account_id: req.user.account_id,
      avitag: profile.avitag,
      profileType: profile.profile_type,
      role,
    });
    setAuthCookies(res, accessToken, refreshToken);

    return res.json({ success: true, data: { avitag: profile.avitag, profileType: profile.profile_type } });
  },

  logout: async (req: Request, res: Response) => {
    // Must be authenticated to logout
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { jti, exp } = req.user;
    if (jti && exp) {
      const now = Math.floor(Date.now() / 1000);
      await revokeToken(jti, Math.max(1, exp - now));
    }
    // Also revoke the refresh token, if present, so a copy of it can't be
    // used to mint fresh access tokens after logout.
    const refreshCookie = req.cookies?.[REFRESH_COOKIE];
    if (refreshCookie) {
      try {
        const payload = verifyRefreshToken(refreshCookie);
        if (payload.jti && payload.exp) {
          const now = Math.floor(Date.now() / 1000);
          await revokeToken(payload.jti, Math.max(1, payload.exp - now));
        }
      } catch {
        // already invalid/expired — nothing to revoke
      }
    }
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out' });
  },
};
