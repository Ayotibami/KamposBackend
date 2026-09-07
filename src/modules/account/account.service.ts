import * as accountRepo from './account.repo';
import * as ProfileUtils from '../profile/utils';
import argon2 from 'argon2';
import { revokeAllForAccount } from '../auth/token.service';

export const AccountService = {
  me: async (account_id: string) => {
    const account = await accountRepo.findAccountById(account_id);
    if (!account) return null;
    const profiles = await ProfileUtils.listByAccount(account_id);
    return { account: accountRepo.toPublicAccount(account), profiles };
  },

  update: async (account_id: string, updates: { email?: string | null }) => {
    if (updates.email) {
      await accountRepo.updateEmail(account_id, updates.email);
    }
    const account = await accountRepo.findAccountById(account_id);
    return account ? accountRepo.toPublicAccount(account) : null;
  },

  changePassword: async (account_id: string, currentPassword: string, newPassword: string) => {
    const account = await accountRepo.findAccountById(account_id);
    if (!account || !account.password_hash) throw Object.assign(new Error('Invalid account'), { statusCode: 400 });
    const ok = await argon2.verify(account.password_hash, currentPassword);
    if (!ok) throw Object.assign(new Error('Current password incorrect'), { statusCode: 401 });
    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await accountRepo.updatePasswordHash(account_id, hash);
    return { changed: true };
  },

  // Self-service delete — soft (account_status = 'DELETED', row/content
  // retained). Terminal: nothing in the app ever transitions an account
  // back out of DELETED. Also kills every other session this account might
  // have open elsewhere — previously this only happened for the CURRENT
  // session, via the frontend's own best-effort /auth/logout call after
  // this resolves, which never reached a second device/browser.
  softDelete: async (account_id: string) => {
    await accountRepo.setAccountStatus(account_id, 'DELETED', null);
    await revokeAllForAccount(account_id);
    return { deleted: true };
  },

  // Self-service deactivate — soft, and unlike delete, meant to be turned
  // back on: see AuthService.reactivate for the other half of this. Kills
  // every open session immediately, same reasoning as softDelete above —
  // the point of deactivating is "I'm stepping away," which should apply
  // everywhere this account is logged in, not just the device the request
  // came from.
  deactivate: async (account_id: string) => {
    await accountRepo.setAccountStatus(account_id, 'DEACTIVATED', null);
    await revokeAllForAccount(account_id);
    return { deactivated: true };
  },
};
