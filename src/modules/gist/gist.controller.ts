import type { Request, Response } from 'express';
import { GistService } from './gist.service';

export const GistController = {
  submit: async (req: Request, res: Response) => {
    const { gist_text, campus_tag, major_tag, level } = req.body || {};
    if (!gist_text || typeof gist_text !== 'string') {
      return res.status(400).json({ success: false, message: 'gist_text is required' });
    }
    if (!req.user?.avitag) {
      return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
    }

    const gist = await GistService.submit({
      gist_text,
      avitag: req.user.avitag,
      campus_tag: campus_tag ?? null,
      major_tag: major_tag ?? null,
      level: level ?? null,
    });

    return res.status(201).json({ success: true, data: gist });
  },
};
