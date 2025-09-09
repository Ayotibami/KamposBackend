-- 0001_init.sql
-- Core enums
CREATE TYPE auth_provider AS ENUM ('EMAIL', 'GOOGLE', 'FACEBOOK', 'APPLE');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'DELETED', 'SUSPENDED');
CREATE TYPE profile_type AS ENUM ('STUDENT', 'KREATOR', 'KOMPANY', 'SCHOOL', 'IDIOT');
CREATE TYPE moderation_status AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE reaction_type AS ENUM ('LIKE', 'LOVE', 'FIRE', 'SAD', 'WOW');
CREATE TYPE media_type AS ENUM ('image', 'video');
CREATE TYPE entity_type AS ENUM ('GIST', 'COMMENT', 'EVENT');
CREATE TYPE notification_type AS ENUM (
  'NEW_GIST', 'GIST_LIKE', 'GIST_COMMENT', 'MAJOR_GIST', 'INSTITUTION_GIST'
);
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reference tables
CREATE TABLE IF NOT EXISTS campus (
  campus_tag TEXT PRIMARY KEY,
  campus_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS major (
  major_tag TEXT PRIMARY KEY,
  major_name TEXT NOT NULL
);

-- Accounts and auth
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  auth_provider auth_provider NOT NULL DEFAULT 'EMAIL',
  is_otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status account_status NOT NULL DEFAULT 'ACTIVE',
  oauth_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  auth_provider auth_provider NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (multi per account)
CREATE TABLE IF NOT EXISTS profiles (
  avitag TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  profile_type profile_type NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  campus_tag TEXT REFERENCES campus(campus_tag),
  major_tag TEXT REFERENCES major(major_tag),
  level INT,
  bio TEXT,
  profile_picture_url TEXT,
  social_links JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_account ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_type ON profiles(profile_type);

-- Audit logs (approvals/verification)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL, -- 'PROFILE_VERIFY','PROFILE_REJECT','GIST_APPROVE','GIST_REJECT'
  target_type TEXT NOT NULL, -- 'PROFILE' | 'GIST'
  target_id TEXT NOT NULL, -- avitag or gist_id
  idiot_avitag TEXT NOT NULL REFERENCES profiles(avitag),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gists
CREATE TABLE IF NOT EXISTS gists (
  gist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gist_text TEXT NOT NULL,
  avitag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  campus_tag TEXT REFERENCES campus(campus_tag),
  major_tag TEXT REFERENCES major(major_tag),
  level INT,
  gist_status moderation_status NOT NULL DEFAULT 'SUBMITTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gists_author ON gists(avitag);
CREATE INDEX IF NOT EXISTS idx_gists_status ON gists(gist_status);
CREATE INDEX IF NOT EXISTS idx_gists_created ON gists(created_at DESC);

-- Full text search (optional basic)
CREATE INDEX IF NOT EXISTS idx_gists_text_gin ON gists USING GIN (to_tsvector('english', gist_text));

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  text TEXT NOT NULL,
  commented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_gist ON comments(gist_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(avitag);

-- Reactions (unique per user+entity)
CREATE TABLE IF NOT EXISTS reactions (
  reaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avitag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  type reaction_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (avitag, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_reactions_entity ON reactions(entity_type, entity_id);

-- Views (auth-only, count every view)
CREATE TABLE IF NOT EXISTS views (
  view_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_views_gist ON views(gist_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON views(avitag);

-- Shares (tracked via GET)
CREATE TABLE IF NOT EXISTS shares (
  share_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shares_gist ON shares(gist_id);

-- Media (multiple per entity, hard delete)
CREATE TABLE IF NOT EXISTS media (
  media_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  media_type media_type NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_media_entity ON media(entity_type, entity_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  host_avi_tags TEXT[] NOT NULL CHECK (array_length(host_avi_tags, 1) >= 1),
  location TEXT, -- campus_tag optional
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  student_avi_tag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_regs_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_regs_student ON event_registrations(student_avi_tag);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avitag TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(avitag);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reported_by TEXT NOT NULL REFERENCES profiles(avitag) ON DELETE CASCADE,
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  action_taken TEXT,
  reviewed_by TEXT REFERENCES profiles(avitag),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_gist ON reports(gist_id);
