import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

/**
 * Edit SQL below as needed, then run once:
 * npx ts-node --transpile-only src\helper\sql.ts
 */
const sql = `
-- enable uuid generator (pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'Email', -- Email, Google, Facebook, Apple
  is_otp_verified BOOLEAN DEFAULT FALSE,
  account_status TEXT NOT NULL DEFAULT 'Active', -- Active, Deleted, Suspended
  oauth_id TEXT UNIQUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- OAuth sessions
CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
  auth_provider TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles (generic for Student, Kompany, Creator, School, Admin)
CREATE TABLE IF NOT EXISTS profiles (
  avitag UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  profile_type TEXT NOT NULL, -- STUDENT, KAMPOSER, CREATOR, ADMIN, SCHOOL
  campus_tag TEXT,
  major_tag TEXT,
  degree TEXT,
  level TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  social_links JSONB,
  engagement_score DOUBLE PRECISION DEFAULT 0,
  earnings_balance DOUBLE PRECISION DEFAULT 0,
  monetization_enabled BOOLEAN DEFAULT FALSE,
  top_gist_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Gists
CREATE TABLE IF NOT EXISTS gists (
  gist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_text TEXT NOT NULL,
  avitag UUID REFERENCES profiles(avitag) ON DELETE SET NULL,
  is_reported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag UUID REFERENCES profiles(avitag) ON DELETE SET NULL,
  text TEXT NOT NULL,
  commented_at TIMESTAMPTZ DEFAULT now()
);

-- Media
CREATE TABLE IF NOT EXISTS media (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'gist', 'event'
  entity_id UUID NOT NULL,
  media_type TEXT NOT NULL, -- 'image', 'video'
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ
);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
  reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'GIST', 'COMMENT'
  entity_id UUID NOT NULL,
  type TEXT NOT NULL, -- LIKE, LOVE, FIRE, SAD, WOW
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  host_avi_tags UUID[] NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
  student_avi_tag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
  type TEXT NOT NULL, -- NEW_GIST, GIST_LIKE, ...
  message TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES profiles(avitag) ON DELETE SET NULL,
  gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'PENDING', -- PENDING, REVIEWED, ACTION_TAKEN, DISMISSED
  action_taken TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Views
CREATE TABLE IF NOT EXISTS views (
  view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
  avitag UUID REFERENCES profiles(avitag) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- OTPS (keep for verification)
CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at);
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
    } catch (err) {}
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
