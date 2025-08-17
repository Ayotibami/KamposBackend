import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

/**
 * Final SQL schema for Kampos — run once (idempotent).
 * npx ts-node --transpile-only src\helper\sql.ts
 */
const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Accounts Table
CREATE TABLE accounts (
    account_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(50) CHECK (auth_provider IN ('Email', 'Google', 'Facebook', 'Apple')) DEFAULT 'Email',
    is_otp_verified BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(50) CHECK (account_status IN ('Active', 'Deleted', 'Suspended')) DEFAULT 'Active',
    oauth_id VARCHAR(255) UNIQUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- OAuth Sessions Table
CREATE TABLE oauth_sessions (
    session_id UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    auth_provider VARCHAR(50) CHECK (auth_provider IN ('Google', 'Facebook', 'Apple')),
    encrypted_refresh_token VARCHAR(255),
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Profiles Table
CREATE TABLE profiles (
    avitag UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    profile_type VARCHAR(50) CHECK (profile_type IN ('STUDENT', 'KAMPOSER', 'CREATOR', 'ADMIN', 'SCHOOL')) DEFAULT 'STUDENT',
    campus_tag VARCHAR(50),
    major_tag VARCHAR(50),
    degree VARCHAR(50) CHECK (degree IN ('Bachelors', 'Masters', 'Phd')),
    level VARCHAR(50) CHECK (level IN ('100', '200', '300', '400', '500')),
    bio TEXT,
    profile_picture_url VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    social_links JSONB,
    engagement_score FLOAT DEFAULT 0,
    earnings_balance FLOAT DEFAULT 0,
    monetization_enabled BOOLEAN DEFAULT FALSE,
    top_gist_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campus Table
CREATE TABLE campus (
    campus_tag VARCHAR(50) PRIMARY KEY,
    campus_name VARCHAR(255) NOT NULL
);

-- Major Table
CREATE TABLE majors (
    major_tag VARCHAR(50) PRIMARY KEY,
    major_name VARCHAR(255) NOT NULL
);

-- Gists Table
CREATE TABLE gists (
    gist_id UUID PRIMARY KEY,
    gist_text TEXT NOT NULL,
    avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    edited_at TIMESTAMP
);

-- Comments Table
CREATE TABLE comments (
    comment_id UUID PRIMARY KEY,
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
    text TEXT NOT NULL,
    commented_at TIMESTAMP DEFAULT NOW()
);

-- Media Table
CREATE TABLE media (
    media_id UUID PRIMARY KEY,
    entity_type VARCHAR(50) CHECK (entity_type IN ('gist', 'event')),
    entity_id UUID,
    media_type VARCHAR(50) CHECK (media_type IN ('image', 'video')),
    media_url VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    edited_at TIMESTAMP,
    thumbnail_url VARCHAR(255)
);

-- Reactions Table
CREATE TABLE reactions (
    reaction_id UUID PRIMARY KEY,
    avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
    entity_type VARCHAR(50) CHECK (entity_type IN ('GIST', 'COMMENT')),
    entity_id UUID,
    type VARCHAR(50) CHECK (type IN ('LIKE', 'LOVE', 'FIRE', 'SAD', 'WOW')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Events Table
CREATE TABLE events (
    event_id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    host_avi_tags TEXT[] NOT NULL CHECK (array_length(host_avi_tags, 1) <= 3),
    location VARCHAR(50) REFERENCES campus(campus_tag),
    description TEXT NOT NULL,
    event_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Event Registrations Table
CREATE TABLE event_registrations (
    id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    student_avi_tag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('NEW_GIST', 'GIST_LIKE', 'GIST_COMMENT', 'MAJOR_GIST', 'INSTITUTION_GIST')),
    message TEXT NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reports Table
CREATE TABLE reports (
    report_id UUID PRIMARY KEY,
    reported_by UUID REFERENCES profiles(avitag) ON DELETE SET NULL,
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(50) CHECK (status IN ('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED')) DEFAULT 'PENDING',
    action_taken TEXT,
    reviewed_by UUID REFERENCES profiles(avitag),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Views Table
CREATE TABLE views (
    view_id UUID PRIMARY KEY,
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag UUID REFERENCES profiles(avitag) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample campus and major data
INSERT INTO campus (campus_tag, campus_name) VALUES
('FUL', 'Federal University Lokoja'),
('OAU', 'Obafemi Awolowo University');

INSERT INTO majors (major_tag, major_name) VALUES
('CSC', 'Computer Science');
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
