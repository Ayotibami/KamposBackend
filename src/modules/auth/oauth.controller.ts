import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { toPublicAccount } from '../account/account.repo';
import { safeErrorMessage, safeErrorStatus } from '../../utils/errors';

export const OAuthController = {
  google: async (req: Request, res: Response) => {
    const { id_token, refresh_token, refresh_expires_at } = req.body || {};
    try {
      const { account, token } = await OAuthService.googleLogin({ id_token, refresh_token, refresh_expires_at });
      return res.status(201).json({ success: true, data: { account: toPublicAccount(account), token } });
    } catch (err: any) {
      return res.status(safeErrorStatus(err, 400)).json({ success: false, message: safeErrorMessage(err, 'Google login failed') });
    }
  },

  facebook: async (req: Request, res: Response) => {
    const { access_token, refresh_token, refresh_expires_at } = req.body || {};
    try {
      const { account, token } = await OAuthService.facebookLogin({ access_token, refresh_token, refresh_expires_at });
      return res.status(201).json({ success: true, data: { account: toPublicAccount(account), token } });
    } catch (err: any) {
      return res.status(safeErrorStatus(err, 400)).json({ success: false, message: safeErrorMessage(err, 'Facebook login failed') });
    }
  },

  apple: async (req: Request, res: Response) => {
    const { identity_token, refresh_token, refresh_expires_at } = req.body || {};
    try {
      const { account, token } = await OAuthService.appleLogin({ identity_token, refresh_token, refresh_expires_at });
      return res.status(201).json({ success: true, data: { account: toPublicAccount(account), token } });
    } catch (err: any) {
      return res.status(safeErrorStatus(err, 400)).json({ success: false, message: safeErrorMessage(err, 'Apple login failed') });
    }
  },
};
