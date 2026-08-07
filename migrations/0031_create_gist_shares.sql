-- 0031_create_gist_shares.sql
-- Tracks when a gist is actually shared out (WhatsApp/X/Facebook/copy-link/
-- native share sheet), separate from a view (which just means someone saw
-- it). Mirrors gist_views: raw rows, no dedup — sharing the same gist
-- twice is a real, separate share, unlike reporting.

CREATE TABLE IF NOT EXISTS gist_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag TEXT,
  platform TEXT,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gist_shares_gist ON gist_shares(gist_id);

-- v_gist_counts, recreated with shares_count added — CREATE OR REPLACE VIEW
-- can append a new trailing column without dropping the view (and whatever
-- depends on it), same technique already relied on for this view's history.
CREATE OR REPLACE VIEW v_gist_counts AS
SELECT
  g.gist_id,
  COALESCE(r.cnt, 0) AS reactions_count,
  COALESCE(c.cnt, 0) AS comments_count,
  COALESCE(v.cnt, 0) AS views_count,
  COALESCE(rep.cnt, 0) AS reports_count,
  COALESCE(s.cnt, 0) AS shares_count
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
) s ON s.gist_id = g.gist_id;
