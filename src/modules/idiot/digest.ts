import { pool } from '../../config/db';
import * as pushRepo from './push.repo';
import * as webpushService from './webpush.service';
import logger from '../../utils/logger';

interface DigestCounts {
  gists: string;
  signups: string;
  logins: string;
  comments: string;
  reactions: string;
}

/**
 * The 30-minute "everything else" digest — gists entering the moderation
 * queue, signups, logins, comments, reactions, combined into ONE push
 * (never five), sent only when at least one of them is actually non-zero.
 * None of these are individually urgent (unlike a report), so bundling on
 * a timer beats an admin's phone buzzing five separate times.
 *
 * "Logins" is an approximation, not a true event count — accounts.last_login
 * is a single most-recent-login timestamp per account (there's no login
 * history table), so this counts DISTINCT accounts that logged in at least
 * once in the window, not total login attempts. Same query shape HQ's own
 * stats.repo.ts already uses for its Today/7d/30d breakdown — a
 * proven-good-enough proxy for "how much login activity," not a precise
 * audit count.
 */
export async function runDigest(): Promise<void> {
  const since = await pushRepo.getLastDigestAt();
  const now = new Date();
  try {
    const { rows } = await pool.query<DigestCounts>(
      `SELECT
        (SELECT COUNT(*) FROM gists WHERE gist_status = 'SUBMITTED' AND created_at > $1) AS gists,
        (SELECT COUNT(*) FROM accounts WHERE created_at > $1) AS signups,
        (SELECT COUNT(*) FROM accounts WHERE last_login > $1) AS logins,
        (SELECT COUNT(*) FROM comments WHERE commented_at > $1) AS comments,
        (SELECT COUNT(*) FROM reactions WHERE created_at > $1) AS reactions`,
      [since]
    );
    const row = rows[0];
    const gists = Number(row.gists);
    const signups = Number(row.signups);
    const logins = Number(row.logins);
    const comments = Number(row.comments);
    const reactions = Number(row.reactions);

    if (gists + signups + logins + comments + reactions > 0) {
      const parts: string[] = [];
      if (gists) parts.push(`${gists} new post${gists === 1 ? '' : 's'}`);
      if (signups) parts.push(`${signups} signup${signups === 1 ? '' : 's'}`);
      if (logins) parts.push(`${logins} login${logins === 1 ? '' : 's'}`);
      if (comments) parts.push(`${comments} comment${comments === 1 ? '' : 's'}`);
      if (reactions) parts.push(`${reactions} reaction${reactions === 1 ? '' : 's'}`);
      await webpushService.sendToAllAdmins({
        title: 'Kampos activity digest',
        body: `${parts.join(', ')} in the last 30 minutes.`,
        url: '/villagepeople',
      });
    }
  } catch (err) {
    logger.error({ err }, 'Digest job failed');
  } finally {
    // Advance the clock even if the send failed above — a transient push
    // failure shouldn't also cause the NEXT window to double-count what
    // this one already tried (and mostly likely did) report on.
    await pushRepo.setLastDigestAt(now);
  }
}
