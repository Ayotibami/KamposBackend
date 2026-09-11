import type { Request, Response } from 'express';
import * as PollRepo from './poll.repo';
import { WSGateway } from '../../ws/gateway';

export const PollController = {
  // Upsert, same shape as ReactionController.upsert — a repeat vote moves
  // the existing one (see voteUpsert's own ON CONFLICT), it never errors
  // just because you'd already picked something.
  vote: async (req: Request, res: Response) => {
    if (!req.user?.avitag) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const gist_id = req.params.gist_id;
    const { option_id } = req.body || {};
    if (typeof option_id !== 'string' || !option_id) {
      return res.status(400).json({ success: false, message: 'option_id is required' });
    }
    const poll = await PollRepo.findByGistId(gist_id);
    if (!poll) return res.status(404).json({ success: false, message: 'This gist has no poll' });
    // The option has to actually belong to THIS gist's poll — without this,
    // a crafted request could vote an option_id borrowed from a completely
    // different gist's poll, landing a vote nobody would ever see counted
    // anywhere real (and silently polluting that other poll's tally).
    const option = await PollRepo.findOptionById(option_id);
    if (!option || option.poll_id !== poll.poll_id) {
      return res.status(400).json({ success: false, message: 'That option isn\'t part of this poll' });
    }
    await PollRepo.voteUpsert(poll.poll_id, option_id, req.user.avitag);
    const fresh = await PollRepo.getPollWithCounts(gist_id);
    try { WSGateway.broadcast('poll:voted', { gist_id, poll: fresh }); } catch {}
    return res.json({ success: true, data: { my_vote_option_id: option_id, poll: fresh } });
  },
};
