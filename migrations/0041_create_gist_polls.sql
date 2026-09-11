-- 0041_create_gist_polls.sql
-- Polls on a gist: a question (the gist's own gist_text — no separate
-- question column) with 2-4 options, one vote per viewer per poll,
-- changeable (ON CONFLICT below updates in place rather than erroring).
-- No expiry column anywhere — a poll stays open exactly as long as the
-- gist itself exists, same as a reaction never expires either.

CREATE TABLE IF NOT EXISTS gist_polls (
  poll_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One poll per gist — enforced here (UNIQUE), not just assumed by the
  -- application, since gist_id is also how every gist-returning query's
  -- poll LATERAL join below looks this row up.
  gist_id UUID NOT NULL UNIQUE REFERENCES gists(gist_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_options (
  option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES gist_polls(poll_id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);

CREATE TABLE IF NOT EXISTS poll_votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES gist_polls(poll_id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(option_id) ON DELETE CASCADE,
  voter_avitag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One vote per voter per poll — changing a vote is an UPDATE against
  -- this constraint (ON CONFLICT ... DO UPDATE SET option_id), not a second
  -- row, same pattern reactions already uses for "one reaction per user".
  UNIQUE (poll_id, voter_avitag)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
