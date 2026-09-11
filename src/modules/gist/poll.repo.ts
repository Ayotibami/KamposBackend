import { pool } from "../../config/db";

/** Shared LATERAL join for every admin-side query that lists gists — the
 * all-gists browser (idiot/gists.repo.ts), the pending-posts queue
 * (gist.repo.ts's listPendingGistsWithDetails), and the pending-reports
 * queue (report.repo.ts's listPendingWithDetails). No viewer parameter
 * (unlike gist.repo.ts's own consumer-facing pollJoin) — an admin reviewing
 * a gist isn't voting, so there's no "my_vote_option_id" to compute here,
 * which is exactly what keeps this one a plain constant instead of needing
 * to be a function like that one. Expects the gist's own row to be aliased
 * `g` in the surrounding query, same assumption pollJoin makes. */
export const ADMIN_POLL_JOIN_SQL = `
  LEFT JOIN LATERAL (
    SELECT json_build_object(
      'poll_id', gp.poll_id,
      'options', COALESCE((
        SELECT json_agg(json_build_object(
          'option_id', po.option_id,
          'option_text', po.option_text,
          'votes_count', (SELECT COUNT(*)::int FROM poll_votes pv WHERE pv.option_id = po.option_id)
        ) ORDER BY po.order_index ASC)
        FROM poll_options po WHERE po.poll_id = gp.poll_id
      ), '[]'::json)
    ) AS poll
    FROM gist_polls gp WHERE gp.gist_id = g.gist_id
  ) pollj ON TRUE
`;

export interface PollOptionInput {
  option_text: string;
}

export interface PollOptionRow {
  option_id: string;
  poll_id: string;
  option_text: string;
  order_index: number;
}

export interface PollRow {
  poll_id: string;
  gist_id: string;
  created_at: string;
}

/** Inserts the poll and its options in one round trip — a poll with zero
 * options makes no sense, so there's no separate "create poll, add options
 * later" path to leave half-finished. Caller (gist.service.ts's create) is
 * responsible for only calling this when the gist itself was just created
 * successfully; there's no transaction wrapping the two together today
 * (same as gist creation + media attachment, which also aren't wrapped in
 * one), so a failure here leaves a poll-less gist behind rather than
 * nothing at all — a safe, visible partial failure, not a silent one. */
export async function createPollForGist(
  gist_id: string,
  options: PollOptionInput[]
): Promise<{ poll: PollRow; options: PollOptionRow[] }> {
  const { rows: pollRows } = await pool.query<PollRow>(
    `INSERT INTO gist_polls (gist_id) VALUES ($1) RETURNING *`,
    [gist_id]
  );
  const poll = pollRows[0];
  const optionRows: PollOptionRow[] = [];
  for (let i = 0; i < options.length; i++) {
    const { rows } = await pool.query<PollOptionRow>(
      `INSERT INTO poll_options (poll_id, option_text, order_index) VALUES ($1, $2, $3) RETURNING *`,
      [poll.poll_id, options[i].option_text, i]
    );
    optionRows.push(rows[0]);
  }
  return { poll, options: optionRows };
}

export async function findByGistId(gist_id: string): Promise<PollRow | null> {
  const { rows } = await pool.query<PollRow>(
    `SELECT * FROM gist_polls WHERE gist_id = $1`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function findOptionById(option_id: string): Promise<PollOptionRow | null> {
  const { rows } = await pool.query<PollOptionRow>(
    `SELECT * FROM poll_options WHERE option_id = $1`,
    [option_id]
  );
  return rows[0] ?? null;
}

/** The public (not-per-viewer) shape a vote broadcast hands to every
 * connected client — no my_vote_option_id here, since a broadcast has no
 * single "viewer" to compute that for; each client already knows its own
 * vote from whichever response it personally got back for casting it. */
export async function getPollWithCounts(gist_id: string): Promise<{
  poll_id: string;
  options: Array<{ option_id: string; option_text: string; votes_count: number }>;
} | null> {
  const poll = await findByGistId(gist_id);
  if (!poll) return null;
  const { rows } = await pool.query<{ option_id: string; option_text: string; votes_count: number }>(
    `SELECT po.option_id, po.option_text,
            (SELECT COUNT(*)::int FROM poll_votes pv WHERE pv.option_id = po.option_id) AS votes_count
     FROM poll_options po WHERE po.poll_id = $1 ORDER BY po.order_index ASC`,
    [poll.poll_id]
  );
  return { poll_id: poll.poll_id, options: rows };
}

/** One vote per (poll, voter) — a repeat vote UPDATEs the existing row's
 * option_id instead of erroring or inserting a second one, which is what
 * actually lets someone change their pick. Callers already have poll_id
 * from their own earlier findByGistId lookup (see poll.controller.ts's
 * vote()), so there's nothing to hand back here. */
export async function voteUpsert(
  poll_id: string,
  option_id: string,
  voter_avitag: string
): Promise<void> {
  await pool.query(
    `INSERT INTO poll_votes (poll_id, option_id, voter_avitag)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, voter_avitag)
     DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
    [poll_id, option_id, voter_avitag]
  );
}
