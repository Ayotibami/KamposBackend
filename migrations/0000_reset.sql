-- 0000_reset.sql
-- Danger: drops all known tables and types for a clean rebuild

-- Drop tables (use CASCADE to remove dependent constraints/indexes)
DROP TABLE IF EXISTS
  views,
  shares,
  reactions,
  comments,
  media,
  event_registrations,
  notifications,
  reports,
  events,
  gists,
  audit_logs,
  profiles,
  oauth_sessions,
  accounts,
  campus,
  major,
  migrations
CASCADE;

-- Drop enums
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    DROP TYPE notification_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type') THEN
    DROP TYPE entity_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    DROP TYPE media_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN
    DROP TYPE reaction_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
    DROP TYPE moderation_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_type') THEN
    DROP TYPE profile_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    DROP TYPE account_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_provider') THEN
    DROP TYPE auth_provider;
  END IF;
END $$;
