-- 0045_create_spots_stack.sql
-- Spot: a video-only feed, sibling to Gist. Always exactly one video per
-- post, so unlike gists (which need a separate gist_media child table for
-- 0-to-many attachments), the video lives denormalized on the spots row
-- itself. No poll, no quoted/repost, no anonymity, no campus/major scoping
-- on the feed itself (poster's own campus/major/level still show on the
-- card via the same profile join gists use, just never used to filter).
-- No approval queue either — a Spot goes straight to ACTIVE on finalize,
-- moderation is reactive (via spot_reports) not a pre-publish gate.

CREATE TYPE spot_status AS ENUM ('DRAFT', 'ACTIVE', 'REJECTED', 'REMOVED');

CREATE TABLE IF NOT EXISTS spots (
  spot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag TEXT NOT NULL,
  account_id UUID NOT NULL,
  profile_id TEXT NOT NULL,
  profile_type TEXT NOT NULL,
  caption TEXT CHECK (char_length(caption) <= 300),
  -- All null until finalize — a DRAFT row is a reservation, not yet a real
  -- post (see spot.repo.ts's finalize()).
  media_url TEXT,
  thumbnail_url TEXT,
  public_id TEXT,
  duration_seconds NUMERIC,
  width INT,
  height INT,
  status spot_status NOT NULL DEFAULT 'DRAFT',
  is_reported BOOLEAN NOT NULL DEFAULT FALSE,
  -- Set to NOW() at finalize time, not at draft-creation time — see
  -- spot.repo.ts's finalize() for why (an abandoned-then-resumed upload
  -- shouldn't backdate into the feed at whenever the draft was first
  -- opened).
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spots_status_created ON spots(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spots_avitag_created ON spots(avitag, created_at DESC);

-- Comments — plain text, no comment-level reactions for v1 (explicit
-- decision — skip the REACTION_COLUMNS join comment.repo.ts's gist
-- comments get).
CREATE TABLE IF NOT EXISTS spot_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  commented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spot_comments_spot_created ON spot_comments(spot_id, commented_at DESC);
CREATE INDEX IF NOT EXISTS idx_spot_comments_avitag_created ON spot_comments(avitag, commented_at DESC);

-- Views — one raw row per playback, no dedup (explicit decision — mirrors
-- gist_views' own "raw rows, no unique constraint" approach).
CREATE TABLE IF NOT EXISTS spot_views (
  view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
  avitag TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spot_views_spot ON spot_views(spot_id);

-- Shares — raw rows, mirrors gist_shares exactly.
CREATE TABLE IF NOT EXISTS spot_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
  avitag TEXT,
  platform TEXT,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spot_shares_spot ON spot_shares(spot_id);

-- Reports — one per (spot, reporter) from day one, unlike Gist which only
-- got this constraint as a later retrofit (see
-- 0030_unique_gist_report_per_reporter.sql, added after the same person
-- could inflate reports_count by reporting repeatedly). No public count is
-- ever shown for this (explicit decision) — it only drives `my_report` on
-- each spot row and the admin moderation queue. Content stays live
-- regardless of report count until an admin actually reviews it — this
-- table is purely the moderation record, never a hiding mechanism by
-- itself.
CREATE TABLE IF NOT EXISTS spot_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
  reporter_avitag TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spot_id, reporter_avitag)
);
CREATE INDEX IF NOT EXISTS idx_spot_reports_spot_created ON spot_reports(spot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spot_reports_status_created ON spot_reports(status, created_at ASC);

-- Reactions are already polymorphic (entity_type/entity_id on a shared
-- `reactions` table) — just add the new entity kind rather than standing
-- up a parallel table. Spot only ever sends type='LIKE' in practice
-- (enforced at the API layer, not the schema) — the action rail is a
-- single heart, not Gist's 5-emoji picker, but the column still technically
-- allows the full enum if that ever changes.
--
-- A new enum value can't be *used* (e.g. in a view's WHERE clause) in the
-- same transaction that adds it — Postgres error 55P04, "New enum values
-- must be committed before they can be used." migrate.ts runs each
-- migration file in one BEGIN/COMMIT, so v_spot_counts (which filters on
-- entity_type = 'SPOT') has to live in the NEXT migration file, after this
-- one has actually committed. See 0046_create_v_spot_counts.sql.
ALTER TYPE reaction_entity ADD VALUE IF NOT EXISTS 'SPOT';
