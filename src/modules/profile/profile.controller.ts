import type { Request, Response } from 'express';
import { ProfileService } from './profile.service';

export const ProfileController = {
  create: async (req: Request, res: Response) => {
    if (!req.user?.account_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { avitag, profile_type, display_name, campus_tag, major_tag, level } = req.body || {};
    if (!avitag || !profile_type) {
      return res.status(400).json({ success: false, message: 'avitag and profile_type are required' });
    }
    // Create hidden profile (is_verified defaults to false in DB)
    try {
      const profile = await ProfileService.create({
        avitag,
        account_id: req.user.account_id,
        profile_type,
        display_name: display_name ?? null,
        campus_tag: campus_tag ?? null,
        major_tag: major_tag ?? null,
        level: level ?? null,
      });
      return res.status(201).json({ success: true, data: profile });
    } catch (err: any) {
      const message = err?.message || 'Failed to create profile';
      return res.status(400).json({ success: false, message });
    }
  },

  meProfiles: async (req: Request, res: Response) => {
    if (!req.user?.account_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const profiles = await ProfileService.listByAccount(req.user.account_id);
    // Hide unverified profiles from public listing elsewhere; here user can see their profiles
    return res.json({ success: true, data: profiles });
  },

  getByAvitag: async (req: Request, res: Response) => {
    const avitag = req.params.avitag;
    const profile = await ProfileService.findByAvitag(avitag);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (!profile.is_verified) {
      // Hide unverified profiles from public access
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    return res.json({ success: true, data: profile });
  },
};
