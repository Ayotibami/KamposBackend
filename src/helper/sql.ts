import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

export const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Lookup tables
CREATE TABLE IF NOT EXISTS campuses (
  campus_tag VARCHAR(50) PRIMARY KEY,
  campus_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS majors (
  major_tag VARCHAR(50) PRIMARY KEY,
  major_name VARCHAR(255) NOT NULL
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  auth_provider VARCHAR(20) NOT NULL CHECK (auth_provider IN ('Email','Google','Facebook','Apple')) DEFAULT 'Email',
  is_otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status VARCHAR(20) NOT NULL CHECK (account_status IN ('Active','Deleted','Suspended')) DEFAULT 'Active',
  oauth_id VARCHAR(255) UNIQUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OAuth Sessions
CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  auth_provider VARCHAR(20) NOT NULL CHECK (auth_provider IN ('Google','Facebook','Apple')),
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles: Student
CREATE TABLE IF NOT EXISTS student_profiles (
  avitag VARCHAR(50) PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  campus_tag VARCHAR(50) REFERENCES campuses(campus_tag),
  hobbies TEXT[],
  degree VARCHAR(20) CHECK (degree IN ('Bachelors','Masters','Phd')),
  major_tag VARCHAR(50) REFERENCES majors(major_tag),
  bio TEXT,
  level VARCHAR(10) CHECK (level IN ('100','200','300','400','500')),
  is_verified BOOLEAN DEFAULT FALSE,
  profile_type VARCHAR(20) NOT NULL DEFAULT 'STUDENT' CHECK (profile_type = 'STUDENT'),
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles: Kompany
CREATE TABLE IF NOT EXISTS kompany_profiles (
  avitag VARCHAR(50) PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  description TEXT,
  logo_url TEXT NOT NULL,
  website TEXT NOT NULL,
  social_links JSONB,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_type VARCHAR(20) NOT NULL DEFAULT 'KOMPANY' CHECK (profile_type = 'KOMPANY'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles: School
CREATE TABLE IF NOT EXISTS school_profiles (
  avitag VARCHAR(50) PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  campus_tag VARCHAR(50) REFERENCES campuses(campus_tag),
  logo_url TEXT,
  website TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_type VARCHAR(20) NOT NULL DEFAULT 'SCHOOL' CHECK (profile_type = 'SCHOOL'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles: Creator
CREATE TABLE IF NOT EXISTS creator_profiles (
  avitag VARCHAR(50) PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  campus_tag VARCHAR(50) REFERENCES campuses(campus_tag),
  profile_image TEXT,
  engagement_score DOUBLE PRECISION,
  earnings_balance DOUBLE PRECISION DEFAULT 0.0,
  monetization_enabled BOOLEAN DEFAULT FALSE,
  top_gist_id UUID,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_type VARCHAR(20) NOT NULL DEFAULT 'CREATOR' CHECK (profile_type = 'CREATOR'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles: Admin
CREATE TABLE IF NOT EXISTS admin_profiles (
  avitag VARCHAR(50) PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  description TEXT,
  profile_image TEXT,
  role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN','MODERATOR','CONTENT_REVIEWER','SUPPORT')),
  permissions JSONB,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_type VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (profile_type = 'ADMIN'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gists
CREATE TABLE IF NOT EXISTS gists (
  gist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag VARCHAR(50) NOT NULL,
  gist_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP WITH TIME ZONE,
  gist_approval BOOLEAN DEFAULT FALSE
);

-- Media (polymorphic: gist or event)
CREATE TABLE IF NOT EXISTS media (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('gist','event')),
  entity_id UUID NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image','video')),
  media_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP WITH TIME ZONE,
  thumbnail_url TEXT
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag VARCHAR(50) NOT NULL,
  text TEXT NOT NULL,
  commented_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reactions (polymorphic: gist or comment)
CREATE TABLE IF NOT EXISTS reactions (
  reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag VARCHAR(50) NOT NULL,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('GIST','COMMENT')),
  entity_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('LIKE','LOVE','FIRE','SAD','WOW')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('NEW_GIST','GIST_LIKE','GIST_COMMENT','MAJOR_GIST','INSTITUTION_GIST')),
  message TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by VARCHAR(50) NOT NULL,
  gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','REVIEWED','ACTION_TAKEN','DISMISSED')) DEFAULT 'PENDING',
  action_taken TEXT,
  reviewed_by VARCHAR(50),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Views
CREATE TABLE IF NOT EXISTS views (
  view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag VARCHAR(50),
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  host_avi_tags TEXT[] NOT NULL,
  location VARCHAR(50) NOT NULL REFERENCES campuses(campus_tag),
  description TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT host_avi_tags_len CHECK (array_length(host_avi_tags,1) <= 3)
);

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  student_avi_tag VARCHAR(255) NOT NULL,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  follower_avitag VARCHAR(50) NOT NULL,
  followee_avitag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_avitag, followee_avitag)
);

-- Blocked Users
CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_avitag VARCHAR(50) NOT NULL,
  blocked_avitag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_avitag, blocked_avitag)
);

-- Validate avitag exists in any profile
CREATE OR REPLACE FUNCTION validate_avitag_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT avitag FROM student_profiles
      UNION SELECT avitag FROM kompany_profiles
      UNION SELECT avitag FROM school_profiles
      UNION SELECT avitag FROM creator_profiles
      UNION SELECT avitag FROM admin_profiles
    ) p WHERE p.avitag = NEW.avitag
  ) THEN
    RAISE EXCEPTION 'Invalid avitag reference: %', NEW.avitag;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  PERFORM 1 FROM pg_trigger WHERE tgname = 'gists_avitag_trigger';
  IF NOT FOUND THEN
    CREATE TRIGGER gists_avitag_trigger BEFORE INSERT OR UPDATE ON gists
    FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'comments_avitag_trigger';
  IF NOT FOUND THEN
    CREATE TRIGGER comments_avitag_trigger BEFORE INSERT OR UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'reactions_avitag_trigger';
  IF NOT FOUND THEN
    CREATE TRIGGER reactions_avitag_trigger BEFORE INSERT OR UPDATE ON reactions
    FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'notifications_avitag_trigger';
  IF NOT FOUND THEN
    CREATE TRIGGER notifications_avitag_trigger BEFORE INSERT OR UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
  END IF;

  PERFORM 1 FROM pg_trigger WHERE tgname = 'views_avitag_trigger';
  IF NOT FOUND THEN
    CREATE TRIGGER views_avitag_trigger BEFORE INSERT OR UPDATE ON views
    FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
  END IF;
END; $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_profiles_student_account ON student_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_creator_account ON creator_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_account ON admin_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_gists_avitag ON gists(avitag);
CREATE INDEX IF NOT EXISTS idx_gists_created_at ON gists(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_gist_id ON comments(gist_id);
CREATE INDEX IF NOT EXISTS idx_media_entity ON media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reactions_entity ON reactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_avitag ON notifications(avitag);
CREATE INDEX IF NOT EXISTS idx_views_gist_id ON views(gist_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
`;

export async function runSqlScript(sqlToRun: string): Promise<void> {
  try {
    await connectDB();
    logger.info("Running SQL script...");
    await pool.query(sqlToRun);
    logger.info("SQL script executed successfully.");
  } catch (error: any) {
    logger.error("Error executing SQL script:", error);
    throw error;
  } finally {
    try {
      await pool.end();
      logger.info("Postgres pool closed.");
    } catch (err) {
      // ignore
    }
  }
}

if (require.main === module) {
  (async () => {
    try {
      await runSqlScript(sql);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })();
}
