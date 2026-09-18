-- 0043_gist_quoted_gist.sql
-- Yarn back (quote-repost): a gist can optionally point at the gist it's
-- quoting. Nullable — most gists never set this. Create-only, same as
-- color_key/polls/is_anonymous: no update path ever sets it after the
-- fact. ON DELETE SET NULL, not CASCADE — if the original gets deleted,
-- the repost (and whatever the reposter actually wrote) stays; it's
-- their own post, it shouldn't vanish because of someone else's action.
-- A gist whose quoted_gist_id has been nulled this way just reads as a
-- plain gist again on the frontend for now (no "original removed" state
-- yet) — a known, deliberately deferred follow-up, not an oversight.
ALTER TABLE gists ADD COLUMN IF NOT EXISTS quoted_gist_id UUID REFERENCES gists(gist_id) ON DELETE SET NULL;

-- Partial — most rows never set this, so indexing only the ones that do
-- keeps it small. Backs both a "find every repost of this gist" lookup
-- and the reposts_count aggregation in v_gist_counts below.
CREATE INDEX IF NOT EXISTS idx_gists_quoted_gist_id ON gists(quoted_gist_id) WHERE quoted_gist_id IS NOT NULL;

-- v_gist_counts, recreated with reposts_count added — same
-- CREATE OR REPLACE VIEW technique 0031_create_gist_shares.sql already
-- used to append shares_count without dropping the view.
CREATE OR REPLACE VIEW v_gist_counts AS
SELECT
  g.gist_id,
  COALESCE(r.cnt, 0) AS reactions_count,
  COALESCE(c.cnt, 0) AS comments_count,
  COALESCE(v.cnt, 0) AS views_count,
  COALESCE(rep.cnt, 0) AS reports_count,
  COALESCE(s.cnt, 0) AS shares_count,
  COALESCE(rp.cnt, 0) AS reposts_count
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
) rep ON rep.gist_id = g.gist_id
LEFT JOIN (
  SELECT gist_id, COUNT(*)::BIGINT AS cnt
  FROM gist_shares
  GROUP BY gist_id
) s ON s.gist_id = g.gist_id
LEFT JOIN (
  SELECT quoted_gist_id AS gist_id, COUNT(*)::BIGINT AS cnt
  FROM gists
  WHERE quoted_gist_id IS NOT NULL
  GROUP BY quoted_gist_id
) rp ON rp.gist_id = g.gist_id;
