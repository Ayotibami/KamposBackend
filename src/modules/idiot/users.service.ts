import argon2 from 'argon2';
import * as accountRepo from '../account/account.repo';
import * as ProfileUtils from '../profile/utils';
import * as usersRepo from './users.repo';
import { safeAudit } from '../audit/audit.util';
import { revokeAllForAccount } from '../auth/token.service';
import { sendAdminMessageEmail } from '../../services/email/email.service';

export const UsersService = {
  search: (filters: usersRepo.UserSearchFilters) => usersRepo.searchUsers(filters),

  getDetail: async (account_id: string) => {
    const account = await accountRepo.findAccountById(account_id);
    if (!account) return null;
    // Full field set (level/campus/major/bio/description/website/...), not
    // the narrow shape listByAccount gives the consumer app's own
    // /account/profile — this is the one screen that actually needs to
    // show everything about every profile under an account.
    const profiles = await ProfileUtils.listByAccountFull(account_id);
    return { account: accountRepo.toPublicAccount(account), profiles };
  },

  // Admin-initiated account creation — no OTP flow attached to this path,
  // so the admin creating it directly stands in for verification instead.
  createAccount: async (email: string, password: string, idiot_avitag: string) => {
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const account = await accountRepo.createAccountEmail(email, password_hash);
    await accountRepo.markOtpVerified(account.account_id);
    account.is_otp_verified = true;
    await safeAudit({ action: 'USER_CREATE', target_type: 'ACCOUNT', target_id: account.account_id, idiot_avitag });
    return accountRepo.toPublicAccount(account);
  },

  updateEmail: async (account_id: string, email: string, idiot_avitag: string) => {
    await accountRepo.updateEmail(account_id, email);
    const account = await accountRepo.findAccountById(account_id);
    if (!account) return null;
    await safeAudit({ action: 'USER_EMAIL_EDIT', target_type: 'ACCOUNT', target_id: account_id, idiot_avitag });
    return accountRepo.toPublicAccount(account);
  },

  // Admin suspend/unsuspend/delete — one endpoint, three targets, since
  // they're mechanically the same write (see account.repo.ts's own
  // setAccountStatus/unsuspendAccount doc comments). `status: 'ACTIVE'`
  // here only ever means "unsuspend" — the caller (controller) already
  // rejects it unless the account is currently SUSPENDED, since undoing a
  // DELETE isn't a thing this route supports (delete is terminal).
  updateStatus: async (
    account_id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DELETED',
    reason: string | null,
    idiot_avitag: string,
  ) => {
    if (status === 'ACTIVE') {
      await accountRepo.unsuspendAccount(account_id);
      await safeAudit({ action: 'ACCOUNT_UNSUSPEND', target_type: 'ACCOUNT', target_id: account_id, idiot_avitag });
    } else {
      await accountRepo.setAccountStatus(account_id, status, reason);
      await revokeAllForAccount(account_id);
      await safeAudit({
        action: status === 'DELETED' ? 'ACCOUNT_DELETE' : 'ACCOUNT_SUSPEND',
        target_type: 'ACCOUNT',
        target_id: account_id,
        idiot_avitag,
        reason,
      });
    }
    const account = await accountRepo.findAccountById(account_id);
    return account ? accountRepo.toPublicAccount(account) : null;
  },

  // One-off admin -> user email — a free-form subject/message an admin
  // writes on the Account Detail page (following up on a report, answering
  // a question, whatever doesn't fit any of the automatic system emails
  // above). The subject line is stored as the audit row's `reason` — a
  // quick "what was this about" a later admin can see at a glance, without
  // needing to go dig up the actual sent email.
  sendMessage: async (account_id: string, email: string, subject: string, message: string, idiot_avitag: string) => {
    await sendAdminMessageEmail(email, subject, message);
    await safeAudit({
      action: 'ADMIN_EMAIL_SENT',
      target_type: 'ACCOUNT',
      target_id: account_id,
      idiot_avitag,
      reason: subject,
    });
  },
};
