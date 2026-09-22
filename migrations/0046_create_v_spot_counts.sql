-- 0046_create_v_spot_counts.sql
-- Split out from 0045 solely because the 'SPOT' reaction_entity value
-- added there can't be referenced in the same transaction it was added in
-- (see 0045's own comment on ALTER TYPE ... ADD VALUE).

CREATE OR REPLACE VIEW v_spot_counts AS
SELECT
  s.spot_id,
  COALESCE(r.cnt, 0) AS reactions_count,
  COALESCE(c.cnt, 0) AS comments_count,
  COALESCE(v.cnt, 0) AS views_count,
  COALESCE(rep.cnt, 0) AS reports_count,
  COALESCE(sh.cnt, 0) AS shares_count
FROM spots s
LEFT JOIN (
  SELECT entity_id, COUNT(*)::BIGINT AS cnt
  FROM reactions
  WHERE entity_type = 'SPOT'
  GROUP BY entity_id
) r ON r.entity_id = s.spot_id
LEFT JOIN (
  SELECT spot_id, COUNT(*)::BIGINT AS cnt
  FROM spot_comments
  GROUP BY spot_id
) c ON c.spot_id = s.spot_id
LEFT JOIN (
  SELECT spot_id, COUNT(*)::BIGINT AS cnt
  FROM spot_views
  GROUP BY spot_id
) v ON v.spot_id = s.spot_id
LEFT JOIN (
  SELECT spot_id, COUNT(*)::BIGINT AS cnt
  FROM spot_reports
  GROUP BY spot_id
) rep ON rep.spot_id = s.spot_id
LEFT JOIN (
  SELECT spot_id, COUNT(*)::BIGINT AS cnt
  FROM spot_shares
  GROUP BY spot_id
) sh ON sh.spot_id = s.spot_id;
