import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
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
CREATE TABLE IF NOT EXISTS oauth_sessions (
    session_id UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    auth_provider VARCHAR(50) CHECK (auth_provider IN ('Google', 'Facebook', 'Apple')),
    encrypted_refresh_token VARCHAR(255),
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Student Profiles Table
CREATE TABLE IF NOT EXISTS student_profiles (
    avitag UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    campus_tag VARCHAR(50) REFERENCES campus(campus_tag),
    major_tag VARCHAR(50) REFERENCES majors(major_tag),
    degree VARCHAR(50) CHECK (degree IN ('Bachelors', 'Masters', 'Phd')),
    level VARCHAR(50) CHECK (level IN ('100', '200', '300', '400', '500')),
    bio TEXT,
    hobbies TEXT[],
    profile_picture_url VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(50) CHECK (profile_type = 'STUDENT') DEFAULT 'STUDENT',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Kompany Profiles Table
CREATE TABLE IF NOT EXISTS kompany_profiles (
    avitag UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    description TEXT,
    logo_url VARCHAR(255) NOT NULL,
    website VARCHAR(255) NOT NULL,
    social_links JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(50) CHECK (profile_type = 'KOMPANY') DEFAULT 'KOMPANY',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- School Profiles Table
CREATE TABLE IF NOT EXISTS school_profiles (
    avitag UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    campus_tag VARCHAR(50) REFERENCES campus(campus_tag),
    logo_url VARCHAR(255),
    website VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(50) CHECK (profile_type = 'SCHOOL') DEFAULT 'SCHOOL',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Creator Profiles Table
CREATE TABLE IF NOT EXISTS creator_profiles (
    avitag UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    campus_tag VARCHAR(50) REFERENCES campus(campus_tag),
    profile_image VARCHAR(255),
    engagement_score FLOAT DEFAULT 0,
    earnings_balance FLOAT DEFAULT 0,
    monetization_enabled BOOLEAN DEFAULT FALSE,
    top_gist_id UUID,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(50) CHECK (profile_type = 'CREATOR') DEFAULT 'CREATOR',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin Profiles Table
CREATE TABLE IF NOT EXISTS admin_profiles (
    avitag UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(account_id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    description TEXT,
    profile_image VARCHAR(255),
    role VARCHAR(50) CHECK (role IN ('SUPER_ADMIN', 'MODERATOR', 'CONTENT_REVIEWER', 'SUPPORT')) NOT NULL,
    permissions JSONB NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(50) CHECK (profile_type = 'ADMIN') DEFAULT 'ADMIN',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campus Table
CREATE TABLE IF NOT EXISTS campus (
    campus_tag VARCHAR(50) PRIMARY KEY,
    campus_name VARCHAR(255) NOT NULL
);

-- Major Table
CREATE TABLE IF NOT EXISTS majors (
    major_tag VARCHAR(50) PRIMARY KEY,
    major_name VARCHAR(255) NOT NULL
);

-- Gists Table
CREATE TABLE IF NOT EXISTS gists (
    gist_id UUID PRIMARY KEY,
    gist_text TEXT NOT NULL,
    avitag UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    edited_at TIMESTAMP,
    gist_approval BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_avitag FOREIGN KEY (avitag) REFERENCES student_profiles(avitag)
        ON DELETE CASCADE
        UNION REFERENCES kompany_profiles(avitag)
        UNION REFERENCES school_profiles(avitag)
        UNION REFERENCES creator_profiles(avitag)
        UNION REFERENCES admin_profiles(avitag)
);

-- Comments Table
CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY,
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag UUID NOT NULL,
    text TEXT NOT NULL,
    commented_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_avitag FOREIGN KEY (avitag) REFERENCES student_profiles(avitag)
        ON DELETE CASCADE
        UNION REFERENCES kompany_profiles(avitag)
        UNION REFERENCES school_profiles(avitag)
        UNION REFERENCES creator_profiles(avitag)
        UNION REFERENCES admin_profiles(avitag)
);

-- Media Table
CREATE TABLE IF NOT EXISTS media (
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
CREATE TABLE IF NOT EXISTS reactions (
    reaction_id UUID PRIMARY KEY,
    avitag UUID NOT NULL,
    entity_type VARCHAR(50) CHECK (entity_type IN ('GIST', 'COMMENT')),
    entity_id UUID,
    type VARCHAR(50) CHECK (type IN ('LIKE', 'LOVE', 'FIRE', 'SAD', 'WOW')),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_avitag FOREIGN KEY (avitag) REFERENCES student_profiles(avitag)
        ON DELETE CASCADE
        UNION REFERENCES kompany_profiles(avitag)
        UNION REFERENCES school_profiles(avitag)
        UNION REFERENCES creator_profiles(avitag)
        UNION REFERENCES admin_profiles(avitag)
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
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
CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    student_avi_tag UUID REFERENCES student_profiles(avitag) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY,
    avitag UUID NOT NULL,
    type VARCHAR(50) CHECK (type IN ('NEW_GIST', 'GIST_LIKE', 'GIST_COMMENT', 'MAJOR_GIST', 'INSTITUTION_GIST')),
    message TEXT NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_avitag FOREIGN KEY (avitag) REFERENCES student_profiles(avitag)
        ON DELETE CASCADE
        UNION REFERENCES kompany_profiles(avitag)
        UNION REFERENCES school_profiles(avitag)
        UNION REFERENCES creator_profiles(avitag)
        UNION REFERENCES admin_profiles(avitag)
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    report_id UUID PRIMARY KEY,
    reported_by UUID,
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(50) CHECK (status IN ('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED')) DEFAULT 'PENDING',
    action_taken TEXT,
    reviewed_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_reported_by FOREIGN KEY (reported_by) REFERENCES student_profiles(avitag)
        ON DELETE SET NULL
        UNION REFERENCES kompany_profiles(avitag)
        UNION REFERENCES school_profiles(avitag)
        UNION REFERENCES creator_profiles(avitag)
        UNION REFERENCES admin_profiles(avitag),
    CONSTRAINT fk_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES admin_profiles(avitag)
        ON DELETE SET NULL
);

-- Views Table
CREATE TABLE IF NOT EXISTS views (
    view_id UUID PRIMARY KEY,
    gist_id UUID REFERENCES gists(gist_id) ON DELETE CASCADE,
    avitag UUID NOT NULL,
    viewed_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_avitag FOREIGN KEY (avitag) REFERENCES student_profiles(avitag)
        ON DELETE CASCADE
        UNION REFERENCES kompany_profiles(avitag)
        UNION REFERENCES school_profiles(avitag)
        UNION REFERENCES creator_profiles(avitag)
        UNION REFERENCES admin_profiles(avitag)
);

-- Insert sample campus and major data
INSERT INTO campus (campus_tag, campus_name) 
VALUES ('FUL', 'Federal University Lokoja'), ('OAU', 'Obafemi Awolowo University')
ON CONFLICT (campus_tag) DO NOTHING;

INSERT INTO majors (major_tag, major_name) 
VALUES ('CSC', 'Computer Science')
ON CONFLICT (major_tag) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_account_id ON oauth_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_account_id ON student_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_kompany_profiles_account_id ON kompany_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_school_profiles_account_id ON school_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_account_id ON creator_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_account_id ON admin_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_gists_avitag ON gists(avitag);
CREATE INDEX IF NOT EXISTS idx_gists_approval ON gists(gist_approval);
CREATE INDEX IF NOT EXISTS idx_comments_gist_id ON comments(gist_id);
CREATE INDEX IF NOT EXISTS idx_comments_avitag ON comments(avitag);
CREATE INDEX IF NOT EXISTS idx_reactions_entity ON reactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_entity ON media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_student_avi_tag ON event_registrations(student_avi_tag);
CREATE INDEX IF NOT EXISTS idx_notifications_avitag ON notifications(avitag);
CREATE INDEX IF NOT EXISTS idx_reports_gist_id ON reports(gist_id);
CREATE INDEX IF NOT EXISTS idx_views_gist_id ON views(gist_id);
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
