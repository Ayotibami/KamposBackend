-- 0034_add_comments_gist_avitag_index.sql
-- listRecent()'s ranked feed checks, per row in every page, whether the
-- viewer has already commented on that gist (part of the "seen" tier
-- split) — existing indexes on comments cover (gist_id) and
-- (gist_id, commented_at) but not (gist_id, avitag) together, which is
-- exactly this lookup's shape.

CREATE INDEX IF NOT EXISTS idx_comments_gist_avitag ON comments(gist_id, avitag);
