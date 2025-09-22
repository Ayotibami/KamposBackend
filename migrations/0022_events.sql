-- 0022_events.sql
-- Events, registrations, views, comments; extend reaction_entity to include EVENT

-- Extend reaction_entity enum to include 'EVENT' if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'reaction_entity' AND e.enumlabel = 'EVENT'
  ) THEN
    ALTER TYPE reaction_entity ADD VALUE 'EVENT';
  END IF;
END $$;

-- Events
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  host_avi_tags TEXT[] NOT NULL CHECK (array_length(host_avi_tags, 1) >= 1 AND array_length(host_avi_tags, 1) <= 3),
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  student_avi_tag TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_regs_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_regs_student ON event_registrations(student_avi_tag);

-- Event views
CREATE TABLE IF NOT EXISTS event_views (
  view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  avitag TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_views_event ON event_views(event_id);

-- Event comments
CREATE TABLE IF NOT EXISTS event_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  commented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_event_comments_event_created ON event_comments(event_id, commented_at DESC);
