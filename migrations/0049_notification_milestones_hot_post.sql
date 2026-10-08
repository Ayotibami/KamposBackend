-- 0049_notification_milestones_hot_post.sql
-- notification_milestones' target_type only allowed GIST/SPOT — written
-- before realizing checkHotExpiring (notification.service.ts) also needs
-- to dedupe "have we already sent the expiring-soon notification for this
-- Hot post" exactly once per post, the same shape as a reaction/like
-- milestone. Widening the CHECK rather than reusing 'GIST' with a Hot
-- post's id, which would have been a structurally wrong mislabel even
-- though both happen to be UUIDs.

ALTER TABLE notification_milestones DROP CONSTRAINT notification_milestones_target_type_check;
ALTER TABLE notification_milestones ADD CONSTRAINT notification_milestones_target_type_check
  CHECK (target_type IN ('GIST', 'SPOT', 'HOT_POST'));
