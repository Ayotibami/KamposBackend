-- 0048_create_notifications.sql
-- In-app notification system — see the product spec this was built from:
-- 9 trigger types split into instant (comment, repost, Hot-about-to-
-- expire), digest (coursemate gist, reaction milestone, trending gist/
-- Amebo, Spot likes — batched every 3 hours), and periodic (inactivity
-- nudge, activation nudge — pure clock-driven, no event row at all).
--
-- Two-table split, deliberately: `notification_events` is the raw log —
-- every trigger writes one row here the instant it happens, whether it'll
-- be shown right away or batched later. `notifications` is what the inbox
-- actually displays — one row per instant event, or one row wrapping an
-- entire 3-hour digest batch for a recipient. This split is what lets the
-- digest batcher just be "read pending events for X, bundle into one
-- notifications row, mark processed" instead of the inbox needing to
-- un-bundle anything at render time.

CREATE TABLE IF NOT EXISTS notification_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_avitag TEXT NOT NULL,
  -- Who/what caused it — null for a milestone/trending crossing, which
  -- isn't "caused" by one specific actor the way a comment is.
  actor_avitag TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'COMMENT', 'REPOST', 'HOT_EXPIRING',
    'COURSEMATE_GIST', 'REACTION_MILESTONE', 'TRENDING_GIST', 'TRENDING_AMEBO', 'SPOT_LIKES'
  )),
  -- Same polymorphic target_type/target_id shape audit.repo.ts's own
  -- AuditAction already uses — one consistent "what does this point at"
  -- pattern across the codebase instead of a second one just for this.
  target_type TEXT NOT NULL CHECK (target_type IN ('GIST', 'SPOT', 'HOT_POST')),
  target_id UUID NOT NULL,
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('INSTANT', 'DIGEST')),
  -- Small denormalized bag of whatever the eventual Kappy line needs
  -- (a reaction count at the moment of crossing, which milestone, etc.)
  -- — cheap to keep here rather than re-deriving it at digest-batch time,
  -- when the live count may have moved on further already.
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Null until this event has been turned into something user-visible —
  -- set immediately for INSTANT (same transaction, effectively), set by
  -- the 3-hour digest batcher for DIGEST rows once it's bundled them.
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notification_events_pending
  ON notification_events (recipient_avitag, delivery_mode)
  WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_avitag TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'COMMENT', 'REPOST', 'HOT_EXPIRING', 'DIGEST', 'INACTIVITY_NUDGE', 'ACTIVATION_NUDGE'
  )),
  -- The actual rendered Kappy line, stored as final text — never a
  -- template reference, so editing the line bank later never rewrites
  -- anyone's existing notification history.
  kappy_line TEXT NOT NULL,
  -- What picture shows alongside it: a real URL (a profile picture, a
  -- gist's media), or the literal string 'kappy' meaning "show his own
  -- static face asset" — never null, every notification shows something.
  image_kind TEXT NOT NULL CHECK (image_kind IN ('KAPPY', 'PROFILE_PICTURE', 'MEDIA')),
  image_url TEXT,
  -- Where tapping this notification navigates — null for the two periodic
  -- nudges, which don't point at any specific piece of content.
  target_type TEXT CHECK (target_type IN ('GIST', 'SPOT', 'HOT_POST', 'PROFILE')),
  target_id TEXT,
  -- For a DIGEST row: the bundled list of what happened (names/avitags,
  -- per-item trigger_type, per-item target) — see notification.service.ts's
  -- own doc comment on the exact shape. Null for every non-digest category.
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_avitag, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_avitag) WHERE read_at IS NULL;

-- Tracks which milestone/trending thresholds have already fired for a
-- given piece of content, so "crossed 25 reactions" fires exactly once,
-- not on every reaction after that point. Kept off the gists/spots tables
-- themselves rather than a column-per-milestone there.
CREATE TABLE IF NOT EXISTS notification_milestones (
  target_type TEXT NOT NULL CHECK (target_type IN ('GIST', 'SPOT')),
  target_id UUID NOT NULL,
  milestone TEXT NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (target_type, target_id, milestone)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  avitag TEXT PRIMARY KEY,
  -- Which trigger_type categories this person has muted — same CHECK
  -- vocabulary as notifications.category above. An absent/empty array
  -- means everything's on, the default for anyone who's never visited
  -- notification settings.
  muted_categories TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- `last_login` only updates on an explicit login/OAuth call, never on the
-- much more frequent silent token refresh — so it under-counts how
-- recently someone's actually used the app (a 30-day refresh token means
-- someone could be active daily for weeks without ever hitting login
-- again). The inactivity nudge needs a real activity signal, not a login
-- signal, hence this separate column.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
