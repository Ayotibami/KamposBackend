import type { Request, Response } from 'express';
import { getHqStats } from './stats.repo';

export const StatsController = {
  // GET /idiot/stats/hq — any admin (isIdiot). Read-only counts, nothing
  // here is sensitive the way the audit log is, so no king-only gate.
  hq: async (_req: Request, res: Response) => {
    const data = await getHqStats();
    return res.json({ success: true, data });
  },
};
