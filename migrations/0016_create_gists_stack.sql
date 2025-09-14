-- 0016_create_gists_stack.sql
-- Fresh schema for Gists, Comments, Reactions, Views, and Media (gist/event), with counts/trending views

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Enums
DO $$ BEGIN
  CREATE TYPE reaction_entity AS ENUM ('GIST','COMMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reaction_type AS ENUM ('LIKE','LOVE','FIRE','SAD','WOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_kind AS ENUM ('IMAGE','VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gists
CREATE TABLE IF NOT EXISTS gists (
  gist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag TEXT NOT NULL,
  gist_text TEXT NOT NULL CHECK (char_length(gist_text) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0,
  is_reported BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_gists_created_at ON gists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gists_avitag_created_at ON gists(avitag, created_at DESC);

-- Gist Media (ordered)
CREATE TABLE IF NOT EXISTS gist_media (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  media_type media_kind NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  order_index INT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gist_media_gist_order ON gist_media(gist_id, order_index ASC);

-- Event Media (no FK to events yet; will add when Events module lands)
CREATE TABLE IF NOT EXISTS event_media (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  media_type media_kind NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  order_index INT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_event_media_event_order ON event_media(event_id, order_index ASC);

-- Comments (hard delete policy)
CREATE TABLE IF NOT EXISTS comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  commented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_gist_created ON comments(gist_id, commented_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_avitag_created ON comments(avitag, commented_at DESC);

-- Reactions (single reaction per user per entity)
CREATE TABLE IF NOT EXISTS reactions (
  reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag TEXT NOT NULL,
  entity_type reaction_entity NOT NULL,
  entity_id UUID NOT NULL,
  type reaction_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, avitag)
);
CREATE INDEX IF NOT EXISTS idx_reactions_entity ON reactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reactions_avitag ON reactions(avitag);

-- Gist Reports + flag on gists
CREATE TABLE IF NOT EXISTS gist_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  reporter_avitag TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gist_reports_gist_created ON gist_reports(gist_id, created_at DESC);

-- Views (raw rows, can dedupe at service layer)
CREATE TABLE IF NOT EXISTS gist_views (
  view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gist_views_gist ON gist_views(gist_id);

-- Convenience COUNT View (likes = all reactions count)
CREATE OR REPLACE VIEW v_gist_counts AS
SELECT
  g.gist_id,
  COALESCE(r.cnt, 0) AS reactions_count,
  COALESCE(c.cnt, 0) AS comments_count,
  COALESCE(v.cnt, 0) AS views_count,
  COALESCE(rep.cnt, 0) AS reports_count
FROM gists g
LEFT JOIN (
  SELECT entity_id, COUNT(*)::BIGINT AS cnt
  FROM reactions
  WHERE entity_type = 'GIST'
  GROUP BY entity_id
) r ON r.entity_id = g.gist_id
LEFT JOIN (
  SELECT gist_id, COUNT(*)::BIGINT AS cnt
  FROM comments
  GROUP BY gist_id
) c ON c.gist_id = g.gist_id
LEFT JOIN (
  SELECT gist_id, COUNT(*)::BIGINT AS cnt
  FROM gist_views
  GROUP BY gist_id
) v ON v.gist_id = g.gist_id
LEFT JOIN (
  SELECT gist_id, COUNT(*)::BIGINT AS cnt
  FROM gist_reports
  GROUP BY gist_id
) rep ON rep.gist_id = g.gist_id;

-- Trending (3 days window, comments weigh 2x)
CREATE OR REPLACE VIEW v_gist_trending_3d AS
WITH
  react AS (
    SELECT entity_id AS gist_id, COUNT(*)::INT AS cnt
    FROM reactions
    WHERE entity_type = 'GIST' AND created_at >= NOW() - INTERVAL '3 days'
    GROUP BY entity_id
  ),
  comm AS (
    SELECT gist_id, COUNT(*)::INT AS cnt
    FROM comments
    WHERE commented_at >= NOW() - INTERVAL '3 days'
    GROUP BY gist_id
  )
SELECT
  g.gist_id,
  COALESCE(react.cnt, 0) + (2 * COALESCE(comm.cnt, 0)) AS score,
  COALESCE(react.cnt, 0) AS reactions_3d,
  COALESCE(comm.cnt, 0) AS comments_3d
FROM gists g
LEFT JOIN react ON react.gist_id = g.gist_id
LEFT JOIN comm ON comm.gist_id = g.gist_id
ORDER BY score DESC;
