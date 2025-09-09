import * as profileRepo from './profile.repo';

export const ProfileService = {
  create: (params: {
    avitag: string;
    account_id: string;
    profile_type: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT';
    display_name?: string | null;
    campus_tag?: string | null;
    major_tag?: string | null;
    level?: number | null;
  }) => profileRepo.createProfile(params),

  findByAvitag: (avitag: string) => profileRepo.findProfile(avitag),
  listByAccount: (account_id: string) => profileRepo.listProfilesByAccount(account_id),
  update: (avitag: string, account_id: string, updates: {
    display_name?: string | null;
    campus_tag?: string | null;
    major_tag?: string | null;
    level?: number | null;
  }) => profileRepo.updateProfile(avitag, account_id, updates),
  close: (avitag: string, account_id: string) => profileRepo.deleteProfile(avitag, account_id),
}
