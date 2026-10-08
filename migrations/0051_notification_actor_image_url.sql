-- 0051_notification_actor_image_url.sql
-- The actor's own photo, kept separate from image_kind/image_url (which
-- now always means "the content's own media" when present) — so a
-- notification can show BOTH an actor chip (who did it) AND a media
-- thumbnail (what it was about) at once when both are known, instead of
-- the two being mutually exclusive. Null whenever there's no actor, the
-- actor has no picture set, or the gist/Spot in question is anonymous.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_image_url TEXT;
