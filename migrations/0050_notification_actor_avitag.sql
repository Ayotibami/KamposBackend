-- 0050_notification_actor_avitag.sql
-- Who (if anyone) triggered this notification — needed separately from
-- image_kind/image_url so the frontend can render an actor chip (avatar +
-- avitag) for person-triggered categories (COMMENT, REPOST) without
-- re-deriving the avitag from kappy_line's free text. Null for anything
-- with no single actor (a milestone crossing, a nudge, a digest's own
-- summary line — each bundled digest item carries its own actor_avitag
-- inside payload instead).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_avitag TEXT;
