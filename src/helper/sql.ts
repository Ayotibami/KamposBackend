import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- Accounts table
  CREATE TABLE IF NOT EXISTS accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Student Profiles table
  CREATE TABLE IF NOT EXISTS student_profiles (
    avitag VARCHAR(50) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    campus_tag VARCHAR(50),
    major_tag VARCHAR(50),
    degree VARCHAR(20) CHECK (degree IN ('Bachelors', 'Masters', 'Phd')),
    level VARCHAR(10) CHECK (level IN ('100', '200', '300', '400', '500')),
    bio TEXT,
    hobbies TEXT[],
    profile_picture_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(20) DEFAULT 'STUDENT' CHECK (profile_type = 'STUDENT'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Kompany Profiles table
  CREATE TABLE IF NOT EXISTS kompany_profiles (
    avitag VARCHAR(50) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    description TEXT,
    logo_url TEXT NOT NULL,
    website TEXT NOT NULL,
    social_links JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(20) DEFAULT 'KOMPANY' CHECK (profile_type = 'KOMPANY'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- School Profiles table
  CREATE TABLE IF NOT EXISTS school_profiles (
    avitag VARCHAR(50) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    campus_tag VARCHAR(50),
    logo_url TEXT,
    website TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(20) DEFAULT 'SCHOOL' CHECK (profile_type = 'SCHOOL'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Creator Profiles table
  CREATE TABLE IF NOT EXISTS creator_profiles (
    avitag VARCHAR(50) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    campus_tag VARCHAR(50),
    profile_image TEXT,
    engagement_score INTEGER DEFAULT 0,
    earnings_balance DECIMAL(10, 2) DEFAULT 0.00,
    monetization_enabled BOOLEAN DEFAULT FALSE,
    top_gist_id UUID,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(20) DEFAULT 'CREATOR' CHECK (profile_type = 'CREATOR'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Admin Profiles table
  CREATE TABLE IF NOT EXISTS admin_profiles (
    avitag VARCHAR(50) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    description TEXT,
    profile_image TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'MODERATOR', 'CONTENT_REVIEWER', 'SUPPORT')),
    permissions TEXT[] NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(20) DEFAULT 'ADMIN' CHECK (profile_type = 'ADMIN'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Gists table
  CREATE TABLE IF NOT EXISTS gists (
    gist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avitag VARCHAR(50) NOT NULL,
    gist_text TEXT NOT NULL,
    media_ids UUID[],
    visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'FOLLOWERS')) DEFAULT 'PUBLIC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE,
    gist_approval BOOLEAN DEFAULT FALSE
  );

  -- Media table
  CREATE TABLE IF NOT EXISTS media (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT')),
    media_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Comments table
  CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag VARCHAR(50) NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Reactions table
  CREATE TABLE IF NOT EXISTS reactions (
    reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag VARCHAR(50) NOT NULL,
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Notifications table
  CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avitag VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('COMMENT', 'REACTION', 'FOLLOW', 'REPORT', 'APPROVAL')),
    action_id UUID NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Reports table
  CREATE TABLE IF NOT EXISTS reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
    avitag VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Views table
  CREATE TABLE IF NOT EXISTS views (
    view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gist_id UUID NOT NULL REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Follows table
  CREATE TABLE IF NOT EXISTS follows (
    follower_avitag VARCHAR(50) NOT NULL,
    followee_avitag VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_avitag, followee_avitag)
  );

  -- Blocked Users table
  CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_avitag VARCHAR(50) NOT NULL,
    blocked_avitag VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_avitag, blocked_avitag)
  );

  -- Sessions table
  CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Trigger function to validate avitag references
  CREATE OR REPLACE FUNCTION validate_avitag_reference()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM (
        SELECT avitag FROM student_profiles
        UNION
        SELECT avitag FROM kompany_profiles
        UNION
        SELECT avitag FROM school_profiles
        UNION
        SELECT avitag FROM creator_profiles
        UNION
        SELECT avitag FROM admin_profiles
      ) AS profiles
      WHERE profiles.avitag = NEW.avitag
    ) THEN
      RAISE EXCEPTION 'Invalid avitag reference: %', NEW.avitag;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Apply trigger to tables referencing avitag
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'gists_avitag_trigger'
    ) THEN
      CREATE TRIGGER gists_avitag_trigger
      BEFORE INSERT OR UPDATE ON gists
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'comments_avitag_trigger'
    ) THEN
      CREATE TRIGGER comments_avitag_trigger
      BEFORE INSERT OR UPDATE ON comments
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'reactions_avitag_trigger'
    ) THEN
      CREATE TRIGGER reactions_avitag_trigger
      BEFORE INSERT OR UPDATE ON reactions
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'notifications_avitag_trigger'
    ) THEN
      CREATE TRIGGER notifications_avitag_trigger
      BEFORE INSERT OR UPDATE ON notifications
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'reports_avitag_trigger'
    ) THEN
      CREATE TRIGGER reports_avitag_trigger
      BEFORE INSERT OR UPDATE ON reports
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'views_avitag_trigger'
    ) THEN
      CREATE TRIGGER views_avitag_trigger
      BEFORE INSERT OR UPDATE ON views
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'follows_follower_trigger'
    ) THEN
      CREATE TRIGGER follows_follower_trigger
      BEFORE INSERT OR UPDATE ON follows
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'follows_followee_trigger'
    ) THEN
      CREATE TRIGGER follows_followee_trigger
      BEFORE INSERT OR UPDATE ON follows
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'blocked_users_blocker_trigger'
    ) THEN
      CREATE TRIGGER blocked_users_blocker_trigger
      BEFORE INSERT OR UPDATE ON blocked_users
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'blocked_users_blocked_trigger'
    ) THEN
      CREATE TRIGGER blocked_users_blocked_trigger
      BEFORE INSERT OR UPDATE ON blocked_users
      FOR EACH ROW EXECUTE FUNCTION validate_avitag_reference();
    END IF;
  END;
  $$;

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_gists_avitag ON gists(avitag);
  CREATE INDEX IF NOT EXISTS idx_gists_created_at ON gists(created_at);
  CREATE INDEX IF NOT EXISTS idx_comments_gist_id ON comments(gist_id);
  CREATE INDEX IF NOT EXISTS idx_reactions_gist_id ON reactions(gist_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_avitag ON notifications(avitag);
  CREATE INDEX IF NOT EXISTS idx_views_gist_id ON views(gist_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower_avitag ON follows(follower_avitag);
  CREATE INDEX IF NOT EXISTS idx_follows_followee_avitag ON follows(followee_avitag);
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
