import * as accountRepo from './account.repo';
import * as ProfileUtils from '../profile/utils';
import argon2 from 'argon2';

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

  softDelete: async (account_id: string) => {
    await accountRepo.softDeleteAccount(account_id);
    return { deleted: true };
  },
};
